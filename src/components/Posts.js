"use client"

import { useState, useEffect, useCallback } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "../AuthContext"
import { getDisasterNews } from "../services/NewsService"

function Posts() {
  const location = useLocation()
  // Initialize activeTab from URL query parameter
  const initTab = new URLSearchParams(location.search).get('tab') === 'news' 
                ? 'news' 
                : 'community'
  const [activeTab, setActiveTab] = useState(initTab)
  const [selectedPost, setSelectedPost] = useState(null)
  const [posts, setPosts] = useState([])
  const [newsPosts, setNewsPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [newsFilter, setNewsFilter] = useState('all')
  const { userLocation, updateUserRadius } = useAuth()
  const navigate = useNavigate()

  // Check if user is logged in
  const isAuthenticated = () => {
    return localStorage.getItem('token') !== null
  }

  // This effect is no longer needed as we initialize from URL params
  // useEffect(() => {
  //   const searchParams = new URLSearchParams(location.search)
  //   const tabParam = searchParams.get('tab')
  //   if (tabParam === 'news') {
  //     setActiveTab('news')
  //   } else if (tabParam === 'community') {
  //     setActiveTab('community')
  //   }
  // }, [location.search])

  // Keep activeTab in sync with URL when location changes
  // This effect is no longer needed as we now handle both via handleTabClick
  // useEffect(() => {
  //   const tabParam = new URLSearchParams(location.search).get('tab')
  //   if (tabParam === 'news' && activeTab !== 'news') {
  //     setActiveTab('news')
  //     window.scrollTo(0, 0) // Scroll to top when changing to news tab
  //   } else if (tabParam === 'community' && activeTab !== 'community') {
  //     setActiveTab('community')
  //     window.scrollTo(0, 0) // Scroll to top when changing to community tab
  //   }
  // }, [location.search, activeTab])

  // Effect to handle direct URL navigation with tab parameter
  useEffect(() => {
    const tabParam = new URLSearchParams(location.search).get('tab');
    if (tabParam === 'news' || tabParam === 'community') {
      // Only update if different to avoid unnecessary re-renders
      if (tabParam !== activeTab) {
        setActiveTab(tabParam);
      }
    }
  }, [location.search]);  // Run only on location.search changes

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      
      // Always use the radius from context
      const radiusParam = userLocation?.radiusMiles || 50;
      const url = `http://localhost:5000/api/posts?radius=${radiusParam}`;
      
      console.log("Fetching posts with radius:", radiusParam);
      
      // Include the auth token in the request
      const token = localStorage.getItem('token');
      const response = await fetch(url, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error('Failed to fetch posts')
      }
      
      // Split posts between community and news (assuming posts with type 'news' are news posts)
      const community = data.filter(post => post.type !== 'news')
      const news = data.filter(post => post.type === 'news')
      
      console.log(`Retrieved ${community.length} community posts and ${news.length} news posts`);
      setPosts(community)
      setNewsPosts(news)
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }, [userLocation?.radiusMiles]);
  
  // Function to fetch news
  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const radiusParam = userLocation?.radiusMiles || 50;
      console.log("Fetching news with radius:", radiusParam);
      
      // Get token for authentication
      const token = localStorage.getItem('token');
      // Pass token to the getDisasterNews function
      const newsData = await getDisasterNews(radiusParam, token);
      setNewsPosts(newsData);
    } catch (err) {
      console.error("Error fetching disaster news:", err);
      setError("Failed to load disaster news. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [userLocation?.radiusMiles]);

  // Single effect to handle all data fetching based on activeTab and location changes
  useEffect(() => {
    // Scroll to top when tab changes
    window.scrollTo(0, 0)
    
    if (activeTab === "community") {
      fetchPosts();
    } else {
      fetchNews();
    }
  }, [userLocation, fetchPosts, fetchNews, activeTab]);

  // Handle radius change from dropdown
  const handleRadiusChange = async (e) => {
    const newRadius = parseInt(e.target.value, 10);
    console.log("Radius changed to:", newRadius);
    
    try {
      // Update radius through the central context method
      await updateUserRadius(newRadius);
    } catch (error) {
      setError("Failed to update radius. Please try again.");
    }
  };

  // Handle tab click - updates both state and URL
  const handleTabClick = (tab) => {
    setActiveTab(tab);
    navigate(`/posts?tab=${tab}`, { replace: true });
    window.scrollTo(0, 0);
  };

  const handlePostClick = (post) => {
    setSelectedPost(selectedPost === post ? null : post)
  }

  const handleVote = async (postId, voteType) => {
    if (!isAuthenticated()) {
      navigate('/login')
      return
    }
    
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`http://localhost:5000/api/posts/${postId}/${voteType}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      const updatedPost = await response.json()
      
      if (!response.ok) {
        throw new Error('Failed to vote')
      }
      
      // Update posts state with the updated post
      setPosts(posts.map(post => post._id === postId || post.id === postId ? updatedPost : post))
    } catch (error) {
      setError(error.message)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    
    const diffTime = Math.abs(now - date)
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60))
    const diffMinutes = Math.floor(diffTime / (1000 * 60))
    
    if (diffDays > 0) {
      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
    } else if (diffHours > 0) {
      return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`
    } else {
      return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`
    }
  }

  // Filter news by disaster type
  const filteredNews = newsFilter === 'all' 
    ? newsPosts 
    : newsPosts.filter(item => item.category?.toLowerCase() === newsFilter || 
                          item.title?.toLowerCase().includes(newsFilter) || 
                          item.description?.toLowerCase().includes(newsFilter));

  // News categories for filtering
  const categories = ['earthquake', 'flood', 'wildfire', 'hurricane', 'tornado'];

  // Helper function to get category badge style (from News.js)
  const getCategoryBadgeStyle = (category) => {
    const baseStyle = {
      display: 'inline-block',
      padding: '4px 8px',
      borderRadius: '4px',
      marginRight: '10px',
      fontWeight: 'bold',
      fontSize: '12px',
      textTransform: 'capitalize',
      color: 'white'
    };
    
    switch (category?.toLowerCase()) {
      case 'earthquake':
        return { ...baseStyle, backgroundColor: '#dc3545' }; // Red
      case 'flood':
        return { ...baseStyle, backgroundColor: '#17a2b8' }; // Teal
      case 'hurricane':
      case 'cyclone':
      case 'typhoon':
        return { ...baseStyle, backgroundColor: '#6f42c1' }; // Purple
      case 'wildfire':
        return { ...baseStyle, backgroundColor: '#fd7e14' }; // Orange
      case 'tornado':
        return { ...baseStyle, backgroundColor: '#20c997' }; // Green
      default:
        return { ...baseStyle, backgroundColor: '#6c757d' }; // Gray
    }
  };

  return (
    <div>
      <h1 style={headerStyle}>Posts</h1>
      {error && <div style={{ color: "red", marginBottom: "15px" }}>{error}</div>}
      
      <div style={tabStyle}>
        <button
          style={activeTab === "community" ? activeTabStyle : inactiveTabStyle}
          onClick={() => handleTabClick("community")}
        >
          Community
        </button>
        <button 
          style={activeTab === "news" ? activeTabStyle : inactiveTabStyle} 
          onClick={() => handleTabClick("news")}
        >
          News
        </button>
      </div>
      
      {userLocation && (
        <div style={radiusControlContainerStyle}>
          <p>Showing posts within <strong>{userLocation.radiusMiles || 50} miles</strong> of your location.</p>
          <div style={radiusDropdownContainerStyle}>
            <label htmlFor="radius-select" style={{marginRight: '10px'}}>Select radius:</label>
            <select
              id="radius-select"
              value={userLocation.radiusMiles || 50}
              onChange={handleRadiusChange}
              style={radiusSelectStyle}
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
      )}
      
      {!isAuthenticated() && activeTab === "community" && (
        <div style={{ marginBottom: "20px", padding: "10px", backgroundColor: "#f8f9fa", borderRadius: "5px" }}>
          <p style={{ margin: 0 }}>
            <a href="/login" style={{ color: "#007bff", textDecoration: "none" }}>Log in</a> or 
            <a href="/signup" style={{ color: "#007bff", textDecoration: "none", marginLeft: "5px" }}>sign up</a> to post in the community section.
          </p>
        </div>
      )}
      
      {isAuthenticated() && activeTab === "community" && (
        <div style={{ marginBottom: "20px" }}>
          <a 
            href="/report" 
            style={{
              display: "inline-block",
              padding: "8px 15px",
              backgroundColor: "#28a745",
              color: "white",
              borderRadius: "4px",
              textDecoration: "none",
              fontWeight: "bold"
            }}
          >
            Create New Post
          </a>
        </div>
      )}
      
      <div style={postsContainerStyle}>
        <h2 style={subHeaderStyle}>{activeTab === "community" ? "Community Reports" : "Latest News"}</h2>
        
        {loading ? (
          <p>Loading posts...</p>
        ) : (
          <ul style={postListStyle}>
            {activeTab === "community" ? (
              posts.length === 0 ? (
                <div style={emptyStateStyle}>
                  <p>No community posts found within {userLocation.radiusMiles || 50} miles of your location.</p>
                  <div style={emptyStateActionsStyle}>
                    <button onClick={() => updateUserRadius(200)} style={actionButtonStyle}>
                      Expand to 200 Miles
                    </button>
                    <button onClick={() => navigate('/report')} style={actionButtonStyle}>
                      Create First Post
                    </button>
                  </div>
                </div>
              ) : (
                posts.map((post) => (
                  <li key={post._id || post.id} style={postItemStyle} onClick={() => handlePostClick(post)}>
                    <h3 style={postTitleStyle}>{post.title}</h3>

                    <p style={postInfoStyle}>
                      Location: {post.location?.displayName || (post.location?.coordinates ? 
                        `${post.location.coordinates[1].toFixed(4)}, ${post.location.coordinates[0].toFixed(4)}` : 
                        "Unknown location")}
                    </p>

                    <p style={postInfoStyle}>Posted by: {post.author} • {formatDate(post.createdAt)}</p>
                    {post.description && <p style={{ margin: "10px 0" }}>{post.description}</p>}
                    <div style={voteContainerStyle}>
                      <button 
                        style={voteButtonStyle} 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVote(post._id || post.id, 'upvote');
                        }}
                      >
                        Upvote ({post.upvotes})
                      </button>
                      <button 
                        style={voteButtonStyle} 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVote(post._id || post.id, 'downvote');
                        }}
                      >
                        Downvote ({post.downvotes})
                      </button>
                    </div>
                    {selectedPost === post && (
                      <div style={commentSectionStyle}>
                        <h4>Comments</h4>
                        {post.comments && post.comments.length > 0 ? (
                          post.comments.map((comment, index) => (
                            <div key={index} style={{ marginBottom: "10px", padding: "8px", backgroundColor: "#f8f9fa", borderRadius: "4px" }}>
                              <p style={{ margin: "0 0 5px 0" }}>{comment.text}</p>
                              <small style={{ color: "#6c757d" }}>By {comment.author} • {formatDate(comment.createdAt)}</small>
                            </div>
                          ))
                        ) : (
                          <p>No comments yet.</p>
                        )}
                      </div>
                    )}
                  </li>
                ))
              )
            ) : (
              <div>
                <div style={filterContainerStyle}>
                  <div style={filterGroupStyle}>
                    <span style={filterLabelStyle}>Filter by:</span>
                    <button 
                      onClick={() => setNewsFilter('all')} 
                      style={{
                        ...filterButtonStyle,
                        backgroundColor: newsFilter === 'all' ? '#007bff' : '#f0f0f0',
                        color: newsFilter === 'all' ? 'white' : '#333'
                      }}
                    >
                      All
                    </button>
                    {categories.map(category => (
                      <button 
                        key={category}
                        onClick={() => setNewsFilter(category)}
                        style={{
                          ...filterButtonStyle,
                          backgroundColor: newsFilter === category ? '#007bff' : '#f0f0f0',
                          color: newsFilter === category ? 'white' : '#333'
                        }}
                      >
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </button>
                    ))}
                  </div>
                  
                  <button onClick={() => fetchNews()} style={refreshButtonStyle}>
                    Refresh News
                  </button>
                </div>
                
                {loading ? (
                  <div style={loadingStyle}>
                    <p>Loading disaster news...</p>
                  </div>
                ) : filteredNews.length === 0 ? (
                  <div style={emptyStyle}>
                    <p>No disaster news found for this filter within {userLocation.radiusMiles || 50} miles of your location.</p>
                    {newsFilter !== 'all' && (
                      <button onClick={() => setNewsFilter('all')} style={actionButtonStyle}>
                        Show All News Types
                      </button>
                    )}
                    {userLocation && (
                      <button onClick={() => updateUserRadius(200)} style={{...actionButtonStyle, marginLeft: '10px'}}>
                        Expand to 200 Miles
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
                            {item.distance !== undefined && (
                              <span style={distanceStyle}>
                                {Math.round(item.distance)} miles away
                              </span>
                            )}
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
            )}
          </ul>
        )}
      </div>
    </div>
  )
}

const headerStyle = {
  color: "#333",
  borderBottom: "2px solid #333",
  paddingBottom: "10px",
}

const tabStyle = {
  display: "flex",
  gap: "10px",
  marginBottom: "20px",
}

const activeTabStyle = {
  padding: "10px 20px",
  backgroundColor: "#007bff",
  color: "white",
  border: "none",
  borderRadius: "5px",
  cursor: "pointer",
}

const inactiveTabStyle = {
  padding: "10px 20px",
  backgroundColor: "#f0f0f0",
  color: "#333",
  border: "none",
  borderRadius: "5px",
  cursor: "pointer",
}

const postsContainerStyle = {
  backgroundColor: "#f9f9f9",
  padding: "20px",
  borderRadius: "5px",
}

const subHeaderStyle = {
  color: "#555",
  marginBottom: "15px",
}

const postListStyle = {
  listStyle: "none",
  padding: 0,
}

const postItemStyle = {
  backgroundColor: "white",
  padding: "15px",
  marginBottom: "15px",
  borderRadius: "5px",
  boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
  cursor: "pointer",
}

const postTitleStyle = {
  color: "#007bff",
  marginBottom: "10px",
}

const postInfoStyle = {
  color: "#666",
  fontSize: "0.9em",
  margin: "5px 0",
}

const voteContainerStyle = {
  display: "flex",
  gap: "10px",
  marginTop: "10px",
}

const voteButtonStyle = {
  padding: "5px 10px",
  backgroundColor: "#f0f0f0",
  border: "1px solid #ddd",
  borderRadius: "3px",
  cursor: "pointer",
}

const commentSectionStyle = {
  marginTop: "15px",
  paddingTop: "15px",
  borderTop: "1px solid #eee",
}

// Radius control styles
const radiusControlContainerStyle = {
  backgroundColor: '#e9f7fe',
  padding: '15px',
  borderRadius: '5px',
  marginBottom: '20px',
};

const radiusDropdownContainerStyle = {
  display: 'flex',
  alignItems: 'center',
  marginTop: '10px',
};

const radiusSelectStyle = {
  padding: '5px 10px',
  borderRadius: '4px',
  border: '1px solid #ccc',
  fontSize: '14px',
};

const emptyStateStyle = {
  textAlign: 'center',
  padding: '30px',
  backgroundColor: '#f8f9fa',
  borderRadius: '5px',
};

const emptyStateActionsStyle = {
  marginTop: '15px',
  display: 'flex',
  justifyContent: 'center',
  gap: '10px',
};

const actionButtonStyle = {
  padding: '8px 16px',
  backgroundColor: '#007bff',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
};

// Add the styles from News.js that we're using
const filterContainerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '20px',
  flexWrap: 'wrap'
};

const filterGroupStyle = {
  display: 'flex',
  alignItems: 'center',
  marginBottom: '10px',
  flexWrap: 'wrap'
};

const filterLabelStyle = {
  fontWeight: 'bold',
  marginRight: '10px'
};

const filterButtonStyle = {
  padding: '6px 12px',
  marginRight: '8px',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontWeight: 'bold',
  marginBottom: '5px'
};

const refreshButtonStyle = {
  padding: '8px 16px',
  backgroundColor: '#28a745',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontWeight: 'bold'
};

const loadingStyle = {
  textAlign: 'center',
  padding: '20px',
  backgroundColor: '#f8f9fa',
  borderRadius: '8px'
};

const emptyStyle = {
  textAlign: 'center',
  padding: '30px',
  backgroundColor: '#f8f9fa',
  borderRadius: '8px',
  marginTop: '20px'
};

const newsContainerStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '20px'
};

const newsItemStyle = {
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: 'white',
  borderRadius: '8px',
  overflow: 'hidden',
  boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
};

const imageContainerStyle = {
  width: '100%',
  height: '200px',
  overflow: 'hidden'
};

const imageStyle = {
  width: '100%',
  height: '100%',
  objectFit: 'cover'
};

const contentStyle = {
  padding: '20px'
};

const titleStyle = {
  fontSize: '1.5rem',
  margin: '0 0 10px',
  lineHeight: '1.3'
};

const descriptionStyle = {
  margin: '0 0 15px',
  color: '#555',
  lineHeight: '1.5'
};

const metaStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  marginBottom: '15px',
  alignItems: 'center'
};

const sourceStyle = {
  marginRight: '15px',
  fontSize: '0.9rem',
  color: '#666'
};

const dateStyle = {
  fontSize: '0.9rem',
  color: '#666'
};

const distanceStyle = {
  marginLeft: 'auto',
  padding: '4px 8px',
  backgroundColor: '#f0f0f0',
  borderRadius: '4px',
  fontSize: '0.8rem',
  fontWeight: 'bold'
};

const readMoreStyle = {
  display: 'inline-block',
  padding: '8px 16px',
  backgroundColor: '#007bff',
  color: 'white',
  borderRadius: '4px',
  textDecoration: 'none',
  fontWeight: 'bold',
  marginTop: '10px'
};

export default Posts