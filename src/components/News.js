"use client"

import { useState, useEffect } from "react"
import { getDisasterNews } from "../services/NewsService"
import { getStoredLocation } from "../services/LocationService"

function News() {
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [location, setLocation] = useState(null)

  useEffect(() => {
    // Load user location
    const userLocation = getStoredLocation()
    if (userLocation) {
      setLocation(userLocation)
    }

    // Fetch disaster news
    fetchDisasterNews()
  }, [])

  const fetchDisasterNews = async () => {
    setLoading(true)
    setError(null)
    try {
      const newsData = await getDisasterNews()
      setNews(newsData)
    } catch (err) {
      console.error("Error fetching disaster news:", err)
      setError("Failed to load disaster news. Please try again later.")
    } finally {
      setLoading(false)
    }
  }

  // Filter news by disaster type
  const filteredNews = filter === 'all' 
    ? news 
    : news.filter(item => item.category?.toLowerCase() === filter || 
                          item.title?.toLowerCase().includes(filter) || 
                          item.description?.toLowerCase().includes(filter))

  // Group news by category for filtering options
  const categories = ['earthquake', 'flood', 'wildfire', 'hurricane', 'tornado']

  return (
    <div>
      <div style={headerStyle}>
        <h1>Disaster News</h1>
        
        {!location && (
          <div style={alertStyle}>
            <p>No location set. For more relevant disaster news, please set your location.</p>
            <a href="/settings" style={buttonStyle}>Set Location</a>
          </div>
        )}
      </div>
      
      <div style={filterContainerStyle}>
        <div style={filterGroupStyle}>
          <span style={filterLabelStyle}>Filter by:</span>
          <button 
            onClick={() => setFilter('all')} 
            style={{
              ...filterButtonStyle,
              backgroundColor: filter === 'all' ? '#007bff' : '#f0f0f0',
              color: filter === 'all' ? 'white' : '#333'
            }}
          >
            All
          </button>
          {categories.map(category => (
            <button 
              key={category}
              onClick={() => setFilter(category)}
              style={{
                ...filterButtonStyle,
                backgroundColor: filter === category ? '#007bff' : '#f0f0f0',
                color: filter === category ? 'white' : '#333'
              }}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </button>
          ))}
        </div>
        
        <button onClick={fetchDisasterNews} style={refreshButtonStyle}>
          Refresh News
        </button>
      </div>
      
      {error && (
        <div style={errorStyle}>
          <p>{error}</p>
          <button onClick={fetchDisasterNews} style={buttonStyle}>Retry</button>
        </div>
      )}
      
      {loading ? (
        <div style={loadingStyle}>
          <p>Loading disaster news...</p>
        </div>
      ) : filteredNews.length === 0 ? (
        <div style={emptyStyle}>
          <p>No disaster news found for this filter.</p>
          {filter !== 'all' && (
            <button onClick={() => setFilter('all')} style={buttonStyle}>
              Show All News
            </button>
          )}
        </div>
      ) : (
        <div style={newsContainerStyle}>
          {filteredNews.map(item => (
            <div key={item.id} style={newsItemStyle}>
              {item.imageUrl && (
                <div style={imageContainerStyle}>
                  <img 
                    src={item.imageUrl} 
                    alt={item.title} 
                    style={imageStyle}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://via.placeholder.com/400x200?text=No+Image';
                    }}
                  />
                </div>
              )}
              <div style={contentStyle}>
                <h2 style={titleStyle}>{item.title}</h2>
                <p style={descriptionStyle}>{item.description}</p>
                <div style={metaStyle}>
                  {item.category && (
                    <span style={getCategoryBadgeStyle(item.category)}>{item.category}</span>
                  )}
                  <span style={sourceStyle}>Source: {item.source}</span>
                  <span style={dateStyle}>{formatDate(item.publishedAt)}</span>
                </div>
                {item.url && (
                  <a 
                    href={item.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    style={readMoreStyle}
                  >
                    Read Full Article
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper function to format date
const formatDate = (dateString) => {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  
  // If date is today, show time
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  
  // If date is yesterday, show "Yesterday"
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  
  // Otherwise show full date
  return date.toLocaleDateString([], { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Helper function to get category badge style
const getCategoryBadgeStyle = (category) => {
  const baseStyle = {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 'bold',
    color: 'white',
  };
  
  if (!category) return { ...baseStyle, backgroundColor: '#6c757d' };
  
  const lowerCategory = category.toLowerCase();
  
  if (lowerCategory.includes('earthquake')) {
    return { ...baseStyle, backgroundColor: '#dc3545' }; // Red
  } else if (lowerCategory.includes('flood')) {
    return { ...baseStyle, backgroundColor: '#0d6efd' }; // Blue
  } else if (lowerCategory.includes('fire') || lowerCategory.includes('wildfire')) {
    return { ...baseStyle, backgroundColor: '#fd7e14' }; // Orange
  } else if (lowerCategory.includes('hurricane') || lowerCategory.includes('cyclone')) {
    return { ...baseStyle, backgroundColor: '#6f42c1' }; // Purple
  } else if (lowerCategory.includes('tornado')) {
    return { ...baseStyle, backgroundColor: '#20c997' }; // Teal
  } else {
    return { ...baseStyle, backgroundColor: '#6c757d' }; // Gray
  }
};

// Styles
const headerStyle = {
  marginBottom: '20px',
};

const alertStyle = {
  backgroundColor: '#fff3cd',
  color: '#856404',
  padding: '10px 15px',
  borderRadius: '5px',
  marginTop: '10px',
  fontSize: '14px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
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
  marginBottom: '20px',
  flexWrap: 'wrap',
  gap: '15px',
};

const filterGroupStyle = {
  display: 'flex',
  gap: '10px',
  alignItems: 'center',
  flexWrap: 'wrap',
};

const filterLabelStyle = {
  fontSize: '14px',
  fontWeight: 'bold',
  color: '#555',
};

const filterButtonStyle = {
  padding: '5px 12px',
  borderRadius: '20px',
  border: 'none',
  fontSize: '14px',
  cursor: 'pointer',
  transition: 'background-color 0.2s',
};

const refreshButtonStyle = {
  padding: '5px 12px',
  backgroundColor: '#f8f9fa',
  border: '1px solid #dee2e6',
  borderRadius: '4px',
  fontSize: '14px',
  cursor: 'pointer',
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
  padding: '50px 0',
  backgroundColor: '#f8f9fa',
  borderRadius: '5px',
};

const emptyStyle = {
  textAlign: 'center',
  padding: '50px 0',
  backgroundColor: '#f8f9fa',
  borderRadius: '5px',
};

const newsContainerStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '25px',
};

const newsItemStyle = {
  display: 'flex',
  gap: '20px',
  backgroundColor: 'white',
  borderRadius: '5px',
  overflow: 'hidden',
  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  flexDirection: 'row',
  alignItems: 'stretch',
};

const imageContainerStyle = {
  width: '250px',
  flexShrink: 0,
  backgroundColor: '#f0f0f0',
};

const imageStyle = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

const contentStyle = {
  padding: '15px',
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
};

const titleStyle = {
  margin: '0 0 10px 0',
  fontSize: '20px',
  color: '#333',
};

const descriptionStyle = {
  margin: '0 0 15px 0',
  fontSize: '14px',
  color: '#555',
  lineHeight: '1.5',
  flex: 1,
};

const metaStyle = {
  display: 'flex',
  gap: '15px',
  flexWrap: 'wrap',
  marginBottom: '15px',
  alignItems: 'center',
};

const sourceStyle = {
  fontSize: '13px',
  color: '#6c757d',
};

const dateStyle = {
  fontSize: '13px',
  color: '#6c757d',
};

const readMoreStyle = {
  alignSelf: 'flex-start',
  padding: '5px 12px',
  backgroundColor: '#007bff',
  color: 'white',
  borderRadius: '4px',
  textDecoration: 'none',
  fontSize: '14px',
  marginTop: 'auto',
};

export default News;