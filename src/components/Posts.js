"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"

function Posts() {
  const [activeTab, setActiveTab] = useState("community")
  const [selectedPost, setSelectedPost] = useState(null)
  const [posts, setPosts] = useState([])
  const [newsPosts, setNewsPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const navigate = useNavigate()
  // For upvote/downvote feedback
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackType, setFeedbackType] = useState(''); // 'success' or 'error'
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  // For searching and filtering posts
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOption, setSortOption] = useState('newest')
  const [typeFilter, setTypeFilter] = useState('all')

  // Check if user is logged in
  const isAuthenticated = () => {
    return localStorage.getItem('token') !== null
  }

  // Fetch posts from the API
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/posts')
        const data = await response.json()

        if (!response.ok) {
          throw new Error('Failed to fetch posts')
        }

        // Split posts between community and news (assuming posts with type 'news' are news posts)
        const community = data.filter(post => post.type !== 'news')
        const news = data.filter(post => post.type === 'news')

        setPosts(community)
        setNewsPosts(news)
      } catch (error) {
        setError(error.message)
      } finally {
        setLoading(false)
      }
    }

    fetchPosts()
  }, [])

  const handlePostClick = (post) => {
    setSelectedPost(selectedPost === post ? null : post)
  }

  // Handle upvote and downvote functionality
  const handleVote = async (postId, voteType) => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }

    try {
      const token = localStorage.getItem('token');

      const response = await fetch(`http://localhost:5000/api/posts/${postId}/${voteType}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || 'Failed to vote');
      }

      const updatedPost = await response.json();

      // Update posts state with the updated post
      setPosts(posts.map(post =>
        post._id === postId ? updatedPost : post
      ));

      setFeedbackMessage(`Successfully ${voteType}d the post!`);
      setFeedbackType('success');
      setFeedbackVisible(true);

      setTimeout(() => {
        setFeedbackVisible(false);
      }, 3000);

    } catch (error) {
      console.error('Vote error:', error);
      setError(error.message);

      setFeedbackMessage(error.message || `Failed to ${voteType} the post`);
      setFeedbackType('error');
      setFeedbackVisible(true);

      setTimeout(() => {
        setFeedbackVisible(false);
      }, 3000);
    }
  };

  const getCurrentUserId = () => {
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      return user?.id;
    } catch (error) {
      console.error('Error getting user ID:', error);
      return null;
    }
  };

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
  };

  // Handle search and filter functionality
  const getFilteredAndSortedPosts = () => {
    let filteredPosts = posts.filter(post => {
      const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesType = typeFilter === 'all' || post.type === typeFilter
      return matchesSearch && matchesType
    })

    // Then sort based on selected option
    switch (sortOption) {
      case 'newest':
        return filteredPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      case 'oldest':
        return filteredPosts.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      case 'most-upvotes':
        return filteredPosts.sort((a, b) => b.upvotes.length - a.upvotes.length)
      case 'least-upvotes':
        return filteredPosts.sort((a, b) => a.upvotes.length - b.upvotes.length)
      case 'a-z':
        return filteredPosts.sort((a, b) => a.title.localeCompare(b.title))
      case 'z-a':
        return filteredPosts.sort((a, b) => b.title.localeCompare(a.title))
      default:
        return filteredPosts
    }
  };

  return (
    <div>
      <h1 style={headerStyle}>Posts</h1>
      {error && <div style={{ color: "red", marginBottom: "15px" }}>{error}</div>}

      <div style={tabStyle}>
        <button
          style={activeTab === "community" ? activeTabStyle : inactiveTabStyle}
          onClick={() => setActiveTab("community")}
        >
          Community
        </button>
        <button
          style={activeTab === "news" ? activeTabStyle : inactiveTabStyle}
          onClick={() => setActiveTab("news")}
        >
          News
        </button>
      </div>

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
            {activeTab === "community" && (
              <>
                {/* Search and filter options */}
                <div className="filter-container" style={filterContainerStyle}>
                  <div className="search-bar" style={searchBarStyle}>
                    <input
                      type="text"
                      placeholder="Search posts by title..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="search-input"
                      style={searchInputStyle}
                    />
                  </div>

                  <div className="filter-options" style={filterOptionsStyle}>
                    <select
                      value={sortOption}
                      onChange={(e) => setSortOption(e.target.value)}
                      className="sort-select"
                      style={selectStyle}
                    >
                      <option value="newest">Most Recent</option>
                      <option value="oldest">Oldest First</option>
                      <option value="most-upvotes">Most Upvotes</option>
                      <option value="least-upvotes">Least Upvotes</option>
                      <option value="a-z">A-Z</option>
                      <option value="z-a">Z-A</option>
                    </select>
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="type-select"
                      style={selectStyle}
                    >
                      <option value="all">All Disaster Types</option>
                      <option value="fire">Fire</option>
                      <option value="flood">Flood</option>
                      <option value="earthquake">Earthquake</option>
                      <option value="hurricane">Hurricane</option>
                      <option value="tornado">Tornado</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {typeFilter !== 'all' && (
                    <button
                      onClick={() => setTypeFilter('all')}
                      className="clear-filter-btn"
                      style={clearFilterBtnStyle}
                    >
                      Clear Filter
                    </button>
                  )}
                </div>

                {/* Show number of results from filter/search */}
                <div className="results-count" style={resultsCountStyle}>
                  {getFilteredAndSortedPosts().length} {getFilteredAndSortedPosts().length === 1 ? 'post' : 'posts'} found
                </div>
              </>
            )}
            {/* Show posts/community reports */}
            {activeTab === "community" ? (
              getFilteredAndSortedPosts().length === 0 ? (
                <p>No posts match your search criteria</p>
              ) : (
                getFilteredAndSortedPosts().map((post) => (
                  <li key={post._id} style={postItemStyle} onClick={() => handlePostClick(post)}>
                    <h3 style={postTitleStyle}>{post.title}</h3>
                    <p style={{ ...postInfoStyle, marginBottom: "5px" }}>
                      <span className="disaster-tag" style={{
                        display: "inline-block",
                        padding: "4px 8px",
                        backgroundColor: getDisasterColor(post.type),
                        color: "#fff",
                        borderRadius: "4px",
                        fontWeight: "bold",
                        fontSize: "0.875rem",
                        marginBottom: "8px"
                      }}>
                        {post.type.charAt(0).toUpperCase() + post.type.slice(1)}
                      </span>
                    </p>
                    <p style={postInfoStyle}>
                      <strong>Location:</strong> {post.location?.displayName || `${post.location?.latitude}, ${post.location?.longitude}`}
                    </p>
                    <p style={postInfoStyle}><strong>Posted by:</strong> {post.author} • {formatDate(post.createdAt)}</p>
                    {post.description && <p style={{ margin: "10px 0" }}>{post.description}</p>}

                    {/* Upvote/Downvote buttons */}
                    <div style={voteContainerStyle}>
                      <button
                        style={{
                          ...voteButtonStyle,
                          backgroundColor: post.upvotes?.includes(getCurrentUserId()) ? '#e6f7ff' : '#f0f0f0'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVote(post._id, 'upvote');
                        }}
                      >
                        Upvote ({Array.isArray(post.upvotes) ? post.upvotes.length : 0})
                      </button>
                      <button
                        style={{
                          ...voteButtonStyle,
                          backgroundColor: post.downvotes?.includes(getCurrentUserId()) ? '#fff1f0' : '#f0f0f0'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVote(post._id, 'downvote');
                        }}
                      >
                        Downvote ({Array.isArray(post.downvotes) ? post.downvotes.length : 0})
                      </button>
                    </div>

                    {/* Comment section */}
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
              newsPosts.length === 0 ? (
                <p>No news articles available.</p>
              ) : (
                newsPosts.map((post) => (
                  <li key={post.id} style={postItemStyle} onClick={() => handlePostClick(post)}>
                    <h3 style={postTitleStyle}>{post.title}</h3>
                    <p style={postInfoStyle}>Source: {post.source || "Official Source"}</p>
                    <p style={postInfoStyle}>Posted: {formatDate(post.createdAt)}</p>
                    {post.description && <p style={{ margin: "10px 0" }}>{post.description}</p>}
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

// Styles for search and filter options

const filterContainerStyle = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "15px",
  marginBottom: "20px",
  padding: "15px",
  backgroundColor: "#f5f5f5",
  borderRadius: "8px",
}

const searchBarStyle = {
  flex: 1,
  minWidth: "200px",
}

const searchInputStyle = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid #ddd",
  borderRadius: "4px",
  fontSize: "14px",
}

const filterOptionsStyle = {
  display: "flex",
  gap: "10px",
}

const selectStyle = {
  padding: "8px 12px",
  border: "1px solid #ddd",
  borderRadius: "4px",
  backgroundColor: "white",
  fontSize: "14px",
}

const clearFilterBtnStyle = {
  padding: "8px 12px",
  backgroundColor: "#f0f0f0",
  border: "1px solid #ddd",
  borderRadius: "4px",
  cursor: "pointer",
  fontSize: "14px",
}

const resultsCountStyle = {
  marginBottom: "15px",
  fontSize: "14px",
  color: "#666",
}

// Disaster type color mapping
const getDisasterColor = (type) => {
  switch (type.toLowerCase()) {
    case 'earthquake':
      return '#dc3545'; // red
    case 'flood':
      return '#0d6efd'; // blue
    case 'fire':
      return '#fd7e14'; // orange
    case 'hurricane':
      return '#6f42c1'; // purple
    case 'tornado':
      return '#20c997'; // teal
    default:
      return '#6c757d'; // gray
  }
}

export default Posts