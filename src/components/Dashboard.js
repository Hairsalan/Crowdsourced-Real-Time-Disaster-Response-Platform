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
  const { userLocation, updateUserRadius } = useAuth();
  const [allCommunityReports, setAllCommunityReports] = useState([]);
  const [allNews, setAllNews] = useState([]);

  useEffect(() => {
    // Load user location
    if (userLocation) {
      setLocation(userLocation);
    }

    // Fetch dashboard data
    fetchAllData();
  }, [userLocation]);

  // Effect to apply radius filtering whenever radius changes
  useEffect(() => {
    console.log(`Applying radius filter of ${userLocation?.radiusMiles || 50} miles to already fetched data`);
    
    if (allCommunityReports.length > 0) {
      applyRadiusFilter();
    }
  }, [userLocation?.radiusMiles, allCommunityReports, allNews]);

  // Fetch all data without filtering first
  const fetchAllData = async () => {
    setLoading(true);
    try {
      console.log("Fetching all dashboard data without radius filtering first");
      
      // Fetch user reports 
      const token = localStorage.getItem('token');
      
      try {
        // Send a very large radius to get all posts from the server
        const url = `http://localhost:5000/api/posts?radius=200`;
        console.log("Fetching all community reports from:", url);
        
        const response = await fetch(url, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch community reports');
        }
        
        const data = await response.json();
        console.log("Retrieved all posts data:", data.length, "posts");
        
        // Filter out news posts, keep only community reports
        const communityReports = data.filter(post => post.type !== 'news');
        console.log("All community posts:", communityReports.length);
        
        // Store all reports
        setAllCommunityReports(communityReports);
      } catch (reportError) {
        console.error("Error fetching community reports:", reportError);
        setAllCommunityReports([]);
      }

      // Fetch all news items without filtering
      try {
        console.log("Fetching all news data with large radius");
        // Use a large radius to get all news
        const newsData = await getDisasterNews(1000, token);
        console.log("All news data:", newsData.length, "items");
        setAllNews(newsData);
      } catch (newsError) {
        console.error("Error fetching news:", newsError);
        setAllNews([]);
      }
      
      // Now apply the current radius filter
      await applyRadiusFilter();
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError("Could not load dashboard data. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // Apply radius filtering to the already fetched data
  const applyRadiusFilter = useCallback(() => {
    if (!userLocation || !userLocation.latitude || !userLocation.longitude) {
      console.log("No location available for filtering");
      return;
    }

    const radiusMiles = userLocation.radiusMiles || 50;
    console.log(`Filtering data with radius: ${radiusMiles} miles`);
    
    // Filter community reports by distance
    const filteredReports = allCommunityReports.filter(post => {
      // Skip posts without location
      if (!post.location || !post.location.coordinates || post.location.coordinates.length < 2) {
        return false;
      }
      
      const postLng = post.location.coordinates[0];
      const postLat = post.location.coordinates[1];
      
      const distance = calculateDistance(
        userLocation.latitude, 
        userLocation.longitude, 
        postLat, 
        postLng
      );
      
      const withinRadius = distance <= radiusMiles;
      console.log(`Post "${post.title}" is ${distance.toFixed(2)} miles away. Within ${radiusMiles} miles? ${withinRadius}`);
      
      return withinRadius;
    });
    
    // Sort by creation date (newest first) and take the 5 most recent
    const sortedReports = filteredReports
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);
    
    console.log(`Filtered to ${filteredReports.length} community reports within ${radiusMiles} miles. Showing ${sortedReports.length}.`);
    setRecentReports(sortedReports);

    // Filter news items by distance
    const filteredNews = allNews.filter(item => {
      // Skip news without distance information
      if (typeof item.distance === 'undefined') {
        return false;
      }
      
      const withinRadius = item.distance <= radiusMiles;
      console.log(`News "${item.title}" is ${item.distance.toFixed(2)} miles away. Within ${radiusMiles} miles? ${withinRadius}`);
      
      return withinRadius;
    });
    
    // Sort by date and take top 5
    const recentNewsItems = filteredNews
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, 5);
    
    console.log(`Filtered to ${filteredNews.length} news items within ${radiusMiles} miles. Showing ${recentNewsItems.length}.`);
    setNewsItems(recentNewsItems);
  }, [userLocation, allCommunityReports, allNews]);

  // Handle radius change directly from dashboard
  const handleRadiusChange = async (e) => {
    const newRadius = parseInt(e.target.value, 10);
    console.log(`Changing radius from ${userLocation?.radiusMiles} to ${newRadius} miles`);
    
    try {
      // Update radius through the central context method
      await updateUserRadius(newRadius);
      
      // Show success message briefly
      setRadiusChangeSuccess(true);
      setTimeout(() => setRadiusChangeSuccess(false), 3000);
    } catch (err) {
      console.error("Error updating radius:", err);
      setError("Could not update alert radius. Please try again.");
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

  return (
    <div>
      <h1 style={headingStyle}>Disaster Alert Dashboard</h1>
      
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
                <strong>Your location:</strong> {location.displayName || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}
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
                {newsItems.map(news => (
                  <div key={news.id} style={newsCardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        {news.category && <span style={getCategoryBadgeStyle(news.category)}>{news.category.toUpperCase()}</span>}
                        <h3 style={{ margin: '5px 0 10px' }}>{news.title}</h3>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span style={{ color: '#666', fontSize: '0.8rem' }}>
                          {formatDate(news.publishedAt)}
                        </span>
                        <span style={{ color: '#666', fontSize: '0.8rem', marginTop: '5px' }}>
                          {news.distance ? `${news.distance.toFixed(1)} miles away` : ''}
                        </span>
                      </div>
                    </div>
                    
                    <p>{news.description}</p>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.9rem' }}>
                        Source: {news.source || 'Unknown'}
                      </div>
                      
                      <a 
                        href={news.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        style={{ 
                          padding: '5px 10px', 
                          background: '#0066cc',
                          color: 'white',
                          borderRadius: '4px',
                          textDecoration: 'none',
                          fontSize: '0.9rem'
                        }}
                      >
                        Read Full Article
                      </a>
                    </div>
                  </div>
                ))}
                
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

export default Dashboard;