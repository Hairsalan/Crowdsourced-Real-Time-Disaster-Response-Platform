import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { getStoredLocation, calculateDistance } from "../services/LocationService";
import { getDisasterNews } from "../services/NewsService";
import { getCommunityReports } from "../services/ReportService";
import { useAuth } from "../AuthContext";

function Dashboard() {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentReports, setRecentReports] = useState([]);
  const [newsItems, setNewsItems] = useState([]);
  const [error, setError] = useState(null);
  const [radiusChangeSuccess, setRadiusChangeSuccess] = useState(false);
  const { userLocation, updateUserRadius, hasLocation } = useAuth();
  const [allCommunityReports, setAllCommunityReports] = useState([]);
  const [allNews, setAllNews] = useState([]);
  const [weatherAlerts, setWeatherAlerts] = useState([]);

  // Helper function to fetch community reports
  const fetchCommunityReports = async (token) => {
    try {
      // Use the user's radius preference instead of a hard-coded value
      const radiusMiles = userLocation?.radiusMiles || 50;
      
      // Build URL with proper location parameters
      let url = `http://localhost:5000/api/posts?radius=${radiusMiles}`;
      
      // Add explicit lat/lng params to ensure filtering works
      if (userLocation && userLocation.latitude && userLocation.longitude) {
        url += `&lat=${userLocation.latitude}&lng=${userLocation.longitude}`;
      }
      
      console.log("Fetching community reports from:", url);
      
      const response = await fetch(url, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch community reports');
      }
      
      const data = await response.json();
      console.log("Retrieved posts data:", data.length, "posts");
      
      // Separate weather alerts (like NWS) from regular community reports
      const weatherAlerts = data.filter(post => {
        return (
          post.source === 'National Weather Service' || 
          post.source === 'USGS Earthquake Hazards Program' ||
          post.source?.includes('NWS') ||
          (post.title?.includes('issued') && post.title?.includes('NWS'))
        );
      });
      
      console.log("Weather alerts found in community data:", weatherAlerts.length);
      if (weatherAlerts.length > 0) {
        weatherAlerts.forEach((alert, i) => {
          console.log(`Weather alert #${i+1}:`, {
            title: alert.title,
            source: alert.source,
            hasCoordinates: alert.location?.coordinates ? "yes" : "no"
          });
        });
      }
      
      // Regular community reports exclude the weather alerts
      const communityReports = data.filter(post => {
        // Check if it's a weather alert
        const isWeatherAlert = (
          post.source === 'National Weather Service' || 
          post.source === 'USGS Earthquake Hazards Program' ||
          post.source?.includes('NWS') ||
          (post.title?.includes('issued') && post.title?.includes('NWS'))
        );
        
        // Keep only non-weather reports
        return !isWeatherAlert;
      });
      
      console.log("Community posts (excluding weather alerts):", communityReports.length);
      
      // Set the weather alerts to be combined with news
      setWeatherAlerts(weatherAlerts);
      
      return communityReports;
    } catch (reportError) {
      console.error("Error fetching community reports:", reportError);
      return [];
    }
  };
  
  // Helper function to fetch news data
  const fetchNewsData = async (token) => {
    try {
      // Use the user's radius preference
      const radiusMiles = userLocation?.radiusMiles || 50;
      console.log(`Fetching news data with radius: ${radiusMiles} miles`);
      
      // Use the user's radius instead of a hard-coded value
      const newsData = await getDisasterNews(radiusMiles, token);
      console.log("News data from API:", newsData.length, "items");
      if (newsData.length > 0) {
        console.log("Sample news item:", newsData[0].title);
      }
      return newsData;
    } catch (newsError) {
      console.error("Error fetching news:", newsError);
      return [];
    }
  };
  
  // Fetch data with the user's radius filter applied
  const fetchAllData = async () => {
    setLoading(true);
    try {
      console.log("Fetching dashboard data with user's radius settings");
      
      // Fetch user reports 
      const token = localStorage.getItem('token');
      
      // Use Promise.all to fetch both data sources in parallel
      const [communityReportsData, newsData] = await Promise.all([
        fetchCommunityReports(token),
        fetchNewsData(token)
      ]);
      
      // Store reports
      setAllCommunityReports(communityReportsData);
      setAllNews(newsData);
      
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError("Could not load dashboard data. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // Process the already filtered data (sort and limit)
  const applyRadiusFilter = useCallback(() => {
    // Check if we have data to process
    if (allCommunityReports.length === 0 && allNews.length === 0 && weatherAlerts.length === 0) {
      console.log("No data available to process");
      return;
    }

    console.log(`Processing ${allCommunityReports.length} community reports, ${allNews.length} news items, and ${weatherAlerts.length} weather alerts`);
    
    // Apply additional client-side radius filtering to ensure correct filtering
    let filteredCommunityReports = allCommunityReports;
    let filteredNewsItems = allNews;
    let filteredWeatherAlerts = weatherAlerts;
    
    // Additional client-side filtering when user has location
    if (userLocation && userLocation.latitude && userLocation.longitude) {
      const radiusMiles = userLocation.radiusMiles || 50;
      console.log(`Applying client-side radius filter of ${radiusMiles} miles`);
      
      // Filter community reports
      filteredCommunityReports = allCommunityReports.filter(report => {
        // Skip reports without location data
        if (!report.location || !report.location.coordinates || report.location.coordinates.length < 2) {
          return false;
        }
        
        const reportLng = report.location.coordinates[0];
        const reportLat = report.location.coordinates[1];
        
        // Earth's radius in km
        const R = 6371;
        
        // Convert coordinates to radians
        const lat1 = userLocation.latitude * Math.PI / 180;
        const lon1 = userLocation.longitude * Math.PI / 180;
        const lat2 = reportLat * Math.PI / 180;
        const lon2 = reportLng * Math.PI / 180;
        
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
      
      // Filter weather alerts
      filteredWeatherAlerts = weatherAlerts.filter(alert => {
        // Skip alerts without location data
        if (!alert.location || !alert.location.coordinates || alert.location.coordinates.length < 2) {
          console.log(`Weather alert missing coordinates: ${alert.title}`);
          return false;
        }
        
        const alertLng = alert.location.coordinates[0];
        const alertLat = alert.location.coordinates[1];
        
        // Earth's radius in km
        const R = 6371;
        
        // Convert coordinates to radians
        const lat1 = userLocation.latitude * Math.PI / 180;
        const lon1 = userLocation.longitude * Math.PI / 180;
        const lat2 = alertLat * Math.PI / 180;
        const lon2 = alertLng * Math.PI / 180;
        
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
        
        const isInRadius = distanceMiles <= radiusMiles;
        if (isInRadius) {
          console.log(`Weather alert in radius: ${alert.title} (${distanceMiles.toFixed(1)} miles)`);
        }
        return isInRadius;
      });
      
      // Filter news items
      filteredNewsItems = allNews.filter(news => {
        // Skip news without location data
        if (!news.latitude || !news.longitude) {
          return false;
        }
        
        const newsLat = parseFloat(news.latitude);
        const newsLng = parseFloat(news.longitude);
        
        if (isNaN(newsLat) || isNaN(newsLng)) {
          return false;
        }
        
        // Earth's radius in km
        const R = 6371;
        
        // Convert coordinates to radians
        const lat1 = userLocation.latitude * Math.PI / 180;
        const lon1 = userLocation.longitude * Math.PI / 180;
        const lat2 = newsLat * Math.PI / 180;
        const lon2 = newsLng * Math.PI / 180;
        
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
      
      console.log(`After client-side filtering: ${filteredCommunityReports.length} community reports, ${filteredNewsItems.length} news items, and ${filteredWeatherAlerts.length} weather alerts`);
    }
    
    // Sort community reports by creation date (newest first) and take the 5 most recent
    const sortedReports = filteredCommunityReports
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);
    
    console.log(`Showing ${sortedReports.length} most recent community reports`);
    setRecentReports(sortedReports);

    // Combine regular news with weather alerts from community posts
    const combinedNewsItems = [
      ...filteredNewsItems,
      ...filteredWeatherAlerts.map(alert => ({
        ...alert,
        // Transform weather alerts to match news format if needed
        isWeatherAlert: true,
        latitude: alert.location?.coordinates[1], // GeoJSON format is [longitude, latitude]
        longitude: alert.location?.coordinates[0],
        publishedAt: alert.createdAt,
        publicationDate: alert.createdAt
      }))
    ];
    
    console.log(`Combined news items (API + weather alerts): ${combinedNewsItems.length}`);
    if (combinedNewsItems.length > 0 && filteredWeatherAlerts.length > 0) {
      console.log("Weather alert sample in combined news:", 
        filteredWeatherAlerts[0].title, 
        "source:", 
        filteredWeatherAlerts[0].source);
    }

    // Sort news items by date and take top 5
    const recentNewsItems = combinedNewsItems
      .sort((a, b) => {
        const dateA = new Date(b.publishedAt || b.publicationDate);
        const dateB = new Date(a.publishedAt || a.publicationDate);
        return dateA - dateB;
      })
      .slice(0, 5);
    
    console.log(`Showing ${recentNewsItems.length} most recent news items (including weather alerts)`);
    setNewsItems(recentNewsItems);
  }, [allCommunityReports, allNews, weatherAlerts, userLocation]);

  useEffect(() => {
    // Load user location
    if (userLocation) {
      setLocation(userLocation);
    }

    // Only fetch dashboard data if the user has a location set
    if (userLocation && hasLocation) {
      fetchAllData();
    }
  }, [userLocation, hasLocation, userLocation?.radiusMiles]);

  // Effect to process data when it's loaded or radius changes
  useEffect(() => {
    console.log(`Processing fetched data to display most recent items`);
    
    if (allCommunityReports.length > 0 || allNews.length > 0 || weatherAlerts.length > 0) {
      applyRadiusFilter();
    }
  }, [userLocation?.radiusMiles, allCommunityReports, allNews, weatherAlerts, applyRadiusFilter]);

  // Handle radius change directly from dashboard
  const handleRadiusChange = async (e) => {
    const newRadius = parseInt(e.target.value, 10);
    console.log(`Changing radius from ${userLocation?.radiusMiles} to ${newRadius} miles`);
    
    try {
      // Update radius through the central context method
      await updateUserRadius(newRadius);
      
      // Explicitly re-fetch all data with the new radius
      console.log("Explicitly re-fetching data with new radius");
      await fetchAllData();
      
      // Show success message briefly
      setRadiusChangeSuccess(true);
      setTimeout(() => setRadiusChangeSuccess(false), 3000);
    } catch (error) {
      console.error("Error updating radius:", error);
      setError("Failed to update radius. Please try again.");
    }
  };

  // Format date function
  const formatDate = (dateString) => {
    if (!dateString) return "";
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) {
      return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Safe helper function to format location coordinates
  const formatCoordinates = (loc) => {
    if (!loc || typeof loc.latitude !== 'number' || typeof loc.longitude !== 'number') {
      return 'Unknown location';
    }
    return `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;
  };

  // When rendering news items, add special handling for weather alerts
  const renderNewsItem = (item) => {
    // Add debug for displaying news items
    console.log("Rendering news item:", item.title, "source:", item.source, "isWeatherAlert:", item.isWeatherAlert ? "yes" : "no");
    
    return (
      <div className="news-item" key={item._id || item.id || `news-${Math.random()}`} style={newsCardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            {item.category && <span style={getCategoryBadgeStyle(item.category)}>{item.category.toUpperCase()}</span>}
            {item.severity && (
              <span style={{
                ...getCategoryBadgeStyle(item.category),
                backgroundColor: getSeverityColor(item.severity),
                marginLeft: '5px'
              }}>
                {item.severity}
              </span>
            )}
            {/* Special badge for NWS alerts */}
            {(item.isWeatherAlert || item.source === 'National Weather Service' || item.source?.includes('NWS')) && (
              <span style={{
                display: 'inline-block',
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '10px',
                backgroundColor: '#ff9800',
                color: 'white',
                fontWeight: 'bold',
                marginLeft: '5px'
              }}>
                ALERT
              </span>
            )}
            <h3 style={{ margin: '5px 0 10px' }}>{item.title}</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ color: '#666', fontSize: '0.8rem' }}>
              {formatDate(item.publishedAt || item.publicationDate || item.createdAt)}
            </span>
            <span style={{ color: '#666', fontSize: '0.8rem', marginTop: '5px' }}>
              {typeof item.distance === 'number' ? `${item.distance.toFixed(1)} miles away` : ''}
            </span>
            {item.source && (
              <span style={{ color: '#666', fontSize: '0.8rem', marginTop: '5px' }}>
                {item.source}
              </span>
            )}
          </div>
        </div>
        
        <p>{item.description}</p>
        
        {/* Add read more button if link exists */}
        {item.link && (
          <div style={{ textAlign: 'right', marginTop: '8px' }}>
            <a 
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              style={{ 
                padding: '5px 10px', 
                backgroundColor: '#007bff', 
                color: '#fff', 
                borderRadius: '3px',
                fontSize: '0.8rem',
                textDecoration: 'none'
              }}
            >
              More Info
            </a>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <h1 style={headingStyle}>Disaster Alert Dashboard</h1>
      
      {!hasLocation && (
        <div style={alertStyle}>
          <h3>Location Required</h3>
          <p>You need to set your location before you can view disaster information. Please visit the <Link to="/settings" style={alertLinkStyle}>Settings</Link> page to set your location.</p>
        </div>
      )}
      
      {hasLocation && (
        <>
          {!location && (
            <div style={alertBoxStyle}>
              <p>No location set. For personalized alerts, please set your location.</p>
              <Link to="/settings" style={buttonStyle}>Set Location</Link>
            </div>
          )}
          
          {location && (
            <div style={locationInfoStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <p>
                    <strong>Your location:</strong> {location.displayName || formatCoordinates(location)}
                  </p>
                  <p>
                    <strong>Alert radius:</strong> {userLocation?.radiusMiles || 50} miles
                  </p>
                </div>
                
                <div style={radiusControlStyle}>
                  <label htmlFor="radius-dropdown">Alert radius: </label>
                  <select 
                    id="radius-dropdown"
                    value={userLocation?.radiusMiles || 50}
                    onChange={handleRadiusChange}
                    style={dropdownStyle}
                  >
                    <option value="5">5 miles</option>
                    <option value="10">10 miles</option>
                    <option value="25">25 miles</option>
                    <option value="50">50 miles</option>
                    <option value="100">100 miles</option>
                    <option value="200">200 miles</option>
                  </select>
                </div>
              </div>
              
              {radiusChangeSuccess && (
                <p style={successMessageStyle}>Alert radius updated!</p>
              )}
              
              <div style={{ marginTop: '15px' }}>
                <Link to="/report" style={buttonStyle}>
                  Create New Report
                </Link>
                <Link to="/posts" style={{ ...buttonStyle, marginLeft: '10px', background: '#2f83e2' }}>
                  View All Posts
                </Link>
                <Link to="/map" style={{ ...buttonStyle, marginLeft: '10px', background: '#28a745' }}>
                  Disaster Map
                </Link>
              </div>
            </div>
          )}
          
          {loading ? (
            <div style={{ textAlign: 'center', margin: '30px 0' }}>
              <p>Loading dashboard data...</p>
            </div>
          ) : (
            <>
              {error && <div style={errorStyle}>{error}</div>}
              
              <div style={sectionStyle}>
                <h2 style={sectionHeadingStyle}>Recent Community Reports</h2>
                {recentReports.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '15px' }}>
                    No recent reports in your area. Be the first to <Link to="/report" style={{ color: '#0066cc' }}>report an event</Link>.
                  </p>
                ) : (
                  <div>
                    {recentReports.map(report => (
                      <div key={report._id} style={reportCardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            {report.type && <span style={getCategoryBadgeStyle(report.type)}>{report.type.toUpperCase()}</span>}
                            <h3 style={{ margin: '5px 0 10px' }}>{report.title}</h3>
                          </div>
                          <div style={{ color: '#666', fontSize: '0.8rem' }}>
                            {formatDate(report.createdAt)}
                          </div>
                        </div>
                        
                        <p>{report.description}</p>
                        
                        {report.location && report.location.displayName && (
                          <p style={{ fontSize: '0.9rem', color: '#666' }}>
                            <strong>Location:</strong> {report.location.displayName}
                          </p>
                        )}
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px' }}>
                          <div style={{ display: 'flex', gap: '15px' }}>
                            <span>
                              <span style={{ color: '#28a745' }}>▲</span> {report.upvotes || 0}
                            </span>
                            <span>
                              <span style={{ color: '#dc3545' }}>▼</span> {report.downvotes || 0}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.9rem' }}>
                            By: {report.author || 'Anonymous'}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div style={{ textAlign: 'center', marginTop: '15px' }}>
                      <Link to="/posts" style={{ color: '#0066cc', textDecoration: 'none' }}>
                        View all community reports →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
              
              <div style={sectionStyle}>
                <h2 style={sectionHeadingStyle}>Recent News</h2>
                {newsItems.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '15px' }}>
                    No recent news in your area. Try increasing your alert radius.
                  </p>
                ) : (
                  <div>
                    {newsItems.map(renderNewsItem)}
                    
                    <div style={{ textAlign: 'center', marginTop: '15px' }}>
                      <Link to="/posts?tab=news" style={{ color: '#0066cc', textDecoration: 'none' }}>
                        View all disaster news →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
      
      <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.8rem', color: '#666' }}>
        <p>
          For accurate and official emergency information, please check with your local authorities.
        </p>
      </div>
    </div>
  );
}

// Helper function to get category badge style
const getCategoryBadgeStyle = (category) => {
  const baseStyle = {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 'bold',
    color: 'white',
    marginBottom: '10px'
  };
  
  if (!category) return { ...baseStyle, backgroundColor: '#6c757d' };
  
  const lowerCategory = category.toLowerCase();
  
  if (lowerCategory.includes('earthquake')) {
    return { ...baseStyle, backgroundColor: '#dc3545' }; // Red
  } else if (lowerCategory.includes('flood')) {
    return { ...baseStyle, backgroundColor: '#0d6efd' }; // Blue
  } else if (lowerCategory.includes('fire')) {
    return { ...baseStyle, backgroundColor: '#fd7e14' }; // Orange
  } else if (lowerCategory.includes('hurricane')) {
    return { ...baseStyle, backgroundColor: '#6f42c1' }; // Purple
  } else if (lowerCategory.includes('tornado')) {
    return { ...baseStyle, backgroundColor: '#20c997' }; // Teal
  } else {
    return { ...baseStyle, backgroundColor: '#6c757d' }; // Gray
  }
};

// Add the severity color function to Dashboard
const getSeverityColor = (severity) => {
  switch (severity?.toLowerCase()) {
    case 'extreme':
      return '#d81b60'; // Deep pink
    case 'severe':
      return '#e53935'; // Red
    case 'moderate':
      return '#fb8c00'; // Orange
    case 'minor':
      return '#43a047'; // Green
    case 'unknown':
    default:
      return '#78909c'; // Blue-grey
  }
};

// Styles
const headingStyle = {
  borderBottom: '2px solid #007bff',
  paddingBottom: '10px',
  marginBottom: '20px',
  color: '#333'
};

const alertBoxStyle = {
  backgroundColor: '#fff3cd',
  color: '#856404',
  padding: '15px',
  borderRadius: '5px',
  marginBottom: '20px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '10px'
};

const locationInfoStyle = {
  backgroundColor: '#e9f7fe',
  padding: '15px',
  borderRadius: '5px',
  marginBottom: '20px',
};

const errorStyle = {
  backgroundColor: '#f8d7da',
  color: '#721c24',
  padding: '15px',
  borderRadius: '5px',
  marginBottom: '20px',
};

const loadingStyle = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '40px 0',
  backgroundColor: '#f8f9fa',
  borderRadius: '5px',
};

const dashboardContainerStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '25px',
};

const sectionStyle = {
  backgroundColor: '#f8f9fa',
  borderRadius: '5px',
  padding: '20px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
};

const sectionHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '15px',
};

const sectionTitleStyle = {
  margin: 0,
  color: '#333',
  fontSize: '20px',
};

const emptyStateStyle = {
  textAlign: 'center',
  padding: '30px',
  backgroundColor: 'white',
  borderRadius: '5px',
};

const listStyle = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '15px',
};

const listItemStyle = {
  backgroundColor: 'white',
  borderRadius: '5px',
  overflow: 'hidden',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
};

const listItemContentStyle = {
  padding: '15px',
};

const itemTitleStyle = {
  margin: '0 0 10px 0',
  fontSize: '18px',
  color: '#333',
};

const itemDescriptionStyle = {
  margin: '0 0 10px 0',
  fontSize: '14px',
  color: '#555',
  lineHeight: '1.4',
};

const itemMetaStyle = {
  display: 'flex',
  gap: '15px',
  fontSize: '12px',
  color: '#777',
  marginBottom: '10px',
};

const actionsContainerStyle = {
  marginTop: '20px',
};

const actionsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '20px',
  marginTop: '15px',
};

const actionCardStyle = {
  backgroundColor: 'white',
  borderRadius: '5px',
  padding: '20px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textDecoration: 'none',
  color: 'inherit',
  transition: 'transform 0.2s',
  ':hover': {
    transform: 'translateY(-5px)',
  }
};

const actionIconStyle = {
  fontSize: '32px',
  marginBottom: '10px',
};

const actionTitleStyle = {
  fontWeight: 'bold',
  margin: '5px 0',
  color: '#333',
};

const actionDescriptionStyle = {
  fontSize: '14px',
  textAlign: 'center',
  color: '#666',
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
  fontWeight: 'bold',
};

const linkStyle = {
  color: '#007bff',
  textDecoration: 'none',
  fontWeight: 'bold',
};

const linkButtonStyle = {
  display: 'inline-block',
  padding: '5px 10px',
  backgroundColor: '#e9f7fe',
  color: '#007bff',
  borderRadius: '4px',
  textDecoration: 'none',
  fontSize: '13px',
  marginTop: '10px',
};

const radiusSelectStyle = {
  padding: '8px 12px',
  borderRadius: '4px',
  border: '1px solid #ccc',
  backgroundColor: 'white',
  fontSize: '14px',
  minWidth: '100px',
};

const locationSettingsButtonStyle = {
  display: 'inline-block',
  padding: '8px 16px',
  backgroundColor: '#e9f7fe',
  color: '#007bff',
  border: '1px solid #007bff',
  borderRadius: '4px',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 'bold',
};

const sectionHeadingStyle = {
  margin: 0,
  color: '#333',
  fontSize: '20px',
};

const reportCardStyle = {
  backgroundColor: 'white',
  borderRadius: '5px',
  padding: '15px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
};

const newsCardStyle = {
  backgroundColor: 'white',
  borderRadius: '5px',
  padding: '15px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
};

const radiusControlStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
};

const dropdownStyle = {
  padding: '8px 12px',
  borderRadius: '4px',
  border: '1px solid #ccc',
  backgroundColor: 'white',
  fontSize: '14px',
  minWidth: '100px',
};

const successMessageStyle = {
  color: '#28a745',
  fontSize: '14px',
  marginTop: '10px',
};

const alertStyle = {
  padding: "20px",
  backgroundColor: "#f8d7da",
  color: "#721c24",
  borderRadius: "5px",
  marginBottom: "20px",
  boxShadow: "0 0 10px rgba(0,0,0,0.1)",
  textAlign: "center"
};

const alertLinkStyle = {
  color: "#721c24",
  fontWeight: "bold",
  textDecoration: "underline"
};

export default Dashboard;