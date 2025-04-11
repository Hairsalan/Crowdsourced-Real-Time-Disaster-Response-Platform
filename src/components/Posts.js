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
      setPosts(posts.map(post => post.id === postId ? updatedPost : post))
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
            {activeTab === "community" ? (
              posts.length === 0 ? (
                <p>No community posts yet. Be the first to post!</p>
              ) : (
                posts.map((post) => (
                  <li key={post.id} style={postItemStyle} onClick={() => handlePostClick(post)}>
                    <h3 style={postTitleStyle}>{post.title}</h3>

                    <p style={postInfoStyle}>
  Location: {post.location?.displayName || `${post.location?.latitude}, ${post.location?.longitude}`}
</p>


                    <p style={postInfoStyle}>Posted by: {post.author} • {formatDate(post.createdAt)}</p>
                    {post.description && <p style={{ margin: "10px 0" }}>{post.description}</p>}
                    <div style={voteContainerStyle}>
                      <button 
                        style={voteButtonStyle} 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVote(post.id, 'upvote');
                        }}
                      >
                        Upvote ({post.upvotes})
                      </button>
                      <button 
                        style={voteButtonStyle} 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVote(post.id, 'downvote');
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

export default Posts