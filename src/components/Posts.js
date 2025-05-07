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
  const [commentText, setCommentText] = useState("")
  const [submittingComment, setSubmittingComment] = useState(false)
  const { userLocation, updateUserRadius, user, loading: userLoading, hasLocation, token, ensureValidToken } = useAuth()
  const navigate = useNavigate()
  const [pinComment, setPinComment] = useState(false)
  const [commentImage, setCommentImage] = useState(null)
  const [commentImagePreview, setCommentImagePreview] = useState(null)

  const isAuthenticated = () => !!user;

  // Add a check if user has a location, if not redirect to settings
  useEffect(() => {
    // Only check after authentication status is loaded and user is logged in
    if (!userLoading && isAuthenticated() && !hasLocation) {
      navigate('/settings');
    }
  }, [userLoading, hasLocation, navigate]);

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
      const radiusMiles = userLocation?.radiusMiles || 50;
      
      // Build the URL with query parameters
      let url = `http://localhost:5000/api/posts?radius=${radiusMiles}`;
      
      // Add explicit lat/lng params to ensure filtering works even if backend doesn't have location
      if (userLocation && userLocation.latitude && userLocation.longitude) {
        url += `&lat=${userLocation.latitude}&lng=${userLocation.longitude}`;
      }
      
      console.log("Fetching posts with URL:", url);
      
      // Use token from context instead of localStorage
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
  }, [userLocation, token]);
  
  // Function to fetch news
  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const radiusParam = userLocation?.radiusMiles || 50;
      console.log("Fetching news with radius:", radiusParam);
      
      // Fetch news from the API
      const newsData = await getDisasterNews(radiusParam, token);
      console.log("Fetched news from API:", newsData.length, "items");
      
      // Fetch additional weather alerts from user reports that should appear in news tab
      let weatherAlerts = [];
      try {
        // Build URL for fetching posts with the appropriate radius
        let url = `http://localhost:5000/api/posts?radius=${radiusParam}`;
        
        // Add explicit lat/lng params
        if (userLocation && userLocation.latitude && userLocation.longitude) {
          url += `&lat=${userLocation.latitude}&lng=${userLocation.longitude}`;
        }
        
        console.log("Fetching community posts to check for weather alerts:", url);
        
        const communityResponse = await fetch(url, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        
        if (communityResponse.ok) {
          const communityData = await communityResponse.json();
          console.log("Fetched community posts:", communityData.length);
          
          // Filter out posts that are weather alerts (NWS, etc)
          weatherAlerts = communityData.filter(post => {
            return (
              post.source === 'National Weather Service' || 
              post.source === 'USGS Earthquake Hazards Program' ||
              post.source?.includes('NWS') ||
              (post.title?.includes('issued') && post.title?.includes('NWS'))
            );
          });
          
          console.log("Found weather alerts in community data:", weatherAlerts.length);
          if (weatherAlerts.length > 0) {
            weatherAlerts.forEach((alert, i) => {
              console.log(`Posts.js - Weather alert #${i+1}:`, {
                title: alert.title,
                source: alert.source,
                hasCoordinates: alert.location?.coordinates ? "yes" : "no"
              });
            });
          }
          
          // Transform weather alerts to match news format
          weatherAlerts = weatherAlerts.map(alert => ({
            ...alert,
            id: alert._id || `weather-${Math.random()}`,
            isWeatherAlert: true,
            category: alert.type || "Weather Alert",
            latitude: alert.location?.coordinates ? alert.location.coordinates[1] : null, // GeoJSON format [lng, lat]
            longitude: alert.location?.coordinates ? alert.location.coordinates[0] : null,
            publishedAt: alert.createdAt,
            publicationDate: alert.createdAt
          }));
        }
      } catch (error) {
        console.error("Error fetching weather alerts:", error);
        // Continue without weather alerts if there's an error
      }
      
      // Combine news data with weather alerts
      const combinedNewsData = [...newsData, ...weatherAlerts];
      console.log("Combined news data:", combinedNewsData.length, "items");
      
      // After getting news from external APIs, check our database for any saved comments
      if (combinedNewsData && combinedNewsData.length > 0) {
        try {
          // Get ID list of all news items
          const newsIds = combinedNewsData.map(item => item.id);
          
          // Fetch any database posts with these externalIds
          const dbPostsResponse = await fetch(`http://localhost:5000/api/posts?type=news`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
          });
          
          if (dbPostsResponse.ok) {
            const dbPosts = await dbPostsResponse.json();
            
            // Filter to only get posts that match our current news items
            const relevantDbPosts = dbPosts.filter(post => post.externalId && newsIds.includes(post.externalId));
            
            // Merge comments from database into news items
            if (relevantDbPosts.length > 0) {
              console.log(`Found ${relevantDbPosts.length} news items with comments in database`);
              
              // Create a map for quick lookup
              const dbPostsMap = {};
              relevantDbPosts.forEach(post => {
                if (post.externalId) {
                  dbPostsMap[post.externalId] = post;
                }
              });
              
              // Merge comments into news items
              const enrichedNewsData = combinedNewsData.map(newsItem => {
                const dbPost = dbPostsMap[newsItem.id];
                if (dbPost && dbPost.comments && dbPost.comments.length > 0) {
                  // Found matching post with comments in database
                  return {
                    ...newsItem,
                    comments: dbPost.comments,
                    dbPostId: dbPost._id || dbPost.id
                  };
                }
                return newsItem;
              });
              
              setNewsPosts(enrichedNewsData);
              return; // We've already set the news posts
            }
          }
        } catch (dbError) {
          console.error("Error checking database for news comments:", dbError);
          // Continue with regular news data if there's an error
        }
      }
      
      // If we didn't return above, set news posts from the combined data
      setNewsPosts(combinedNewsData);
    } catch (err) {
      console.error("Error fetching disaster news:", err);
      setError("Failed to load disaster news. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [userLocation?.radiusMiles, userLocation?.latitude, userLocation?.longitude, token]);

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
      setLoading(true);
      
      // Use the token validation helper from context
      const isTokenValid = await ensureValidToken();
      
      if (!isTokenValid) {
        setError("Authentication error. Please log in again.");
        navigate('/login');
        return;
      }
      
      // Now we can be more confident the token is valid
      console.log(`Voting ${voteType} for post: ${postId}`);
      const response = await fetch(`http://localhost:5000/api/posts/${postId}/${voteType}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const updatedPost = await response.json();
      if (!response.ok) {
        setError(updatedPost.message || 'Failed to vote');
        return;
      }
      
      setError("");
      setPosts(posts.map(post => post._id === postId || post.id === postId ? updatedPost : post));
    } catch (error) {
      console.error("Vote error:", error);
      setError(error.message || "Failed to process vote");
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (dateString) => {
    // Return fallback value if dateString is invalid
    if (!dateString) return "Unknown time";
    
    try {
      const date = new Date(dateString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) return "Unknown time";
      
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
    } catch (error) {
      console.error("Date formatting error:", error);
      return "Unknown time";
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

  // Add a function to handle image upload
  const handleCommentImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (limit to 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError("Image file is too large. Maximum size is 5MB.");
        return;
      }
      
      // Check file type
      if (!file.type.startsWith('image/')) {
        setError("Only image files are allowed.");
        return;
      }
      
      setCommentImage(file);
      
      // Create a preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setCommentImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
      
      setError("");
    }
  };
  
  // Add function to remove the image
  const removeCommentImage = () => {
    setCommentImage(null);
    setCommentImagePreview(null);
  };

  // Update handleAddComment to include the image
  const handleAddComment = async (postId) => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    
    if (!commentText.trim() && !commentImage) {
      setError("Comment must contain text or an image");
      return;
    }
    
    // For News tab, don't allow any comments
    if (activeTab === "news") {
      setError("Commenting on news items has been temporarily disabled");
      return;
    }
    
    setSubmittingComment(true);
    
    try {
      // Use the token validation helper from context
      const isTokenValid = await ensureValidToken();
      
      if (!isTokenValid) {
        setError("Authentication error. Please log in again.");
        navigate('/login');
        return;
      }
      
      // For news items, we need to check if there's a post for this news item in the database
      // If not, create one first
      let actualPostId = postId;
      
      if (activeTab === "news") {
        try {
          // Find the news item from our state
          const newsItem = filteredNews.find(item => item.id === postId);
          
          if (!newsItem) {
            setError("Could not find news item details");
            return;
          }
          
          console.log("News item found:", newsItem.title);
          
          // Use stored dbPostId if available (meaning we already have a database entry for this news item)
          if (newsItem.dbPostId) {
            console.log("Using existing database post ID:", newsItem.dbPostId);
            actualPostId = newsItem.dbPostId;
          } else {
            // Check if we already have a database post for this news item
            // Use a GET request with a special query parameter to look up by external ID
            console.log("Looking up post with externalId:", postId);
            const checkResponse = await fetch(`http://localhost:5000/api/posts/lookup?externalId=${postId}`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            
            if (checkResponse.ok) {
              // We found an existing post for this news item
              const existingPost = await checkResponse.json();
              actualPostId = existingPost._id || existingPost.id;
              console.log("Found existing post in database with ID:", actualPostId);
            } else {
              console.log("No existing post found, creating new one");
              // Create a new post to represent this news item
              const createResponse = await fetch('http://localhost:5000/api/posts', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  title: newsItem.title,
                  description: newsItem.description,
                  type: 'news',
                  externalId: newsItem.id,
                  source: newsItem.source,
                  category: newsItem.category,
                  link: newsItem.url,
                  location: newsItem.latitude && newsItem.longitude ? {
                    coordinates: [newsItem.longitude, newsItem.latitude],
                    displayName: newsItem.location || `${newsItem.latitude}, ${newsItem.longitude}`
                  } : null,
                  publishedAt: newsItem.publicationDate || newsItem.publishedAt
                })
              });
              
              if (!createResponse.ok) {
                const errorData = await createResponse.json();
                console.error("Failed to create post:", errorData);
                throw new Error(errorData.message || 'Failed to create post for news item');
              }
              
              const newPost = await createResponse.json();
              actualPostId = newPost._id || newPost.id;
              console.log("Created new post in database with ID:", actualPostId);
            }
          }
        } catch (lookupError) {
          console.error("Error during post lookup/creation:", lookupError);
          setError("Failed to prepare database entry for comment: " + lookupError.message);
          setSubmittingComment(false);
          return;
        }
      }
      
      // Submit the comment - use FormData for multipart/form-data to handle images
      console.log(`Adding comment to post ID: ${actualPostId}`);
      
      const formData = new FormData();
      formData.append('text', commentText);
      if (commentImage) {
        formData.append('image', commentImage);
      }
      formData.append('isPinned', pinComment && user.role === 'ngo'); // Only NGOs can pin comments
      
      const response = await fetch(`http://localhost:5000/api/posts/${actualPostId}/comment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Comment submission error:", errorData);
        setError(errorData.message || 'Failed to add comment');
        setSubmittingComment(false);
        return;
      }
      
      const updatedPost = await response.json();
      
      // If this is a news item, we need to update our UI differently
      if (activeTab === "news") {
        // Find the news item in state
        const updatedItem = { ...selectedPost };
        
        // Add the comments from updatedPost to the news item
        updatedItem.comments = updatedPost.comments || [];
        
        // Store the database post ID for future use
        updatedItem.dbPostId = actualPostId;
        
        // Update the selected item with comments
        setSelectedPost(updatedItem);
        
        // Update the item in the newsPosts array too
        const updatedNewsPosts = newsPosts.map(item => 
          item.id === selectedPost.id ? { 
            ...item, 
            comments: updatedPost.comments,
            dbPostId: actualPostId  // Store the database post ID in the news item
          } : item
        );
        
        // Set the updated news posts array
        setNewsPosts(updatedNewsPosts);
        
        // After state updates, ensure the item remains selected by setting selectedPost again
        // This ensures the reference is maintained between render cycles
        setTimeout(() => {
          const updatedPost = updatedNewsPosts.find(item => item.id === selectedPost.id);
          if (updatedPost) {
            setSelectedPost(updatedPost);
          }
        }, 0);
      } else {
        // For community posts, update as before
        const newPosts = posts.map(post => 
          post._id === actualPostId || post.id === actualPostId ? updatedPost : post
        );
        setPosts(newPosts);
        
        // Also update the selectedPost reference to keep the comments section open
        if (selectedPost && (selectedPost._id === actualPostId || selectedPost.id === actualPostId)) {
          setSelectedPost(updatedPost);
        }
      }
      
      // Clear comment input, image, and pin checkbox
      setCommentText("");
      setCommentImage(null);
      setCommentImagePreview(null);
      setPinComment(false);
      setError("");
    } catch (error) {
      console.error("Comment error:", error);
      setError(error.message || "Failed to add comment");
    } finally {
      setSubmittingComment(false);
    }
  };

  // Function to determine comment style based on user role
  const getCommentStyle = (comment) => {
    // If the comment is pinned, make it green
    if (comment.isPinned) {
      return {
        backgroundColor: "#d4edda", // light green
        borderLeft: "4px solid #28a745",
      };
    }
    
    // Default style for all comments (regardless of role)
    return {
      backgroundColor: "#f8f9fa", // light gray
      borderLeft: "4px solid #6c757d"
    };
  };
  
  const getRoleBadge = (post, authorId) => {
    if (!authorId) return null;
    
    let role = "user"; // Default role
    
    if (post.userRoles && post.userRoles[authorId]) {
      role = post.userRoles[authorId];
    }
    
    const badgeStyle = {
      display: "inline-block",
      padding: "2px 5px",
      fontSize: "0.7em",
      fontWeight: "bold",
      borderRadius: "3px",
      marginLeft: "5px",
      textTransform: "uppercase",
    };
    
    switch (role.toLowerCase()) {
      case 'admin':
        return (
          <span style={{...badgeStyle, backgroundColor: "#dc3545", color: "white"}}>
            ADMIN
          </span>
        );
      case 'moderator':
        return (
          <span style={{...badgeStyle, backgroundColor: "#17a2b8", color: "white"}}>
            MOD
          </span>
        );
      case 'ngo':
        return (
          <span style={{...badgeStyle, backgroundColor: "#28a745", color: "white"}}>
            NGO
          </span>
        );
      default:
        return null; // No badge for regular users
    }
  };

  // Helper to sort comments (pinned ones first)
  const sortComments = (comments) => {
    if (!comments || !Array.isArray(comments)) return [];
    
    return [...comments].sort((a, b) => {
      // Pinned comments go first
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      
      // If both have same pin status, sort by date (newest first)
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  };

  // Add helper function to check if user is a moderator or admin
  const isModeratorOrAdmin = () => {
    return user && (user.role === 'moderator' || user.role === 'admin');
  };

  // Add function to handle comment deletion
  const handleDeleteComment = async (postId, commentId, e) => {
    if (!isModeratorOrAdmin()) return;
    
    // Stop event propagation to prevent post click
    e.stopPropagation();
    
    try {
      setError("");
      
      // Confirm deletion
      if (!window.confirm("Are you sure you want to delete this comment?")) {
        return;
      }
      
      const response = await fetch(`http://localhost:5000/api/posts/${postId}/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to delete comment");
      }
      
      const data = await response.json();
      
      // Update the posts list
      if (activeTab === "community") {
        const updatedPosts = posts.map(post => 
          post._id === postId ? data.post : post
        );
        setPosts(updatedPosts);
        
        // Update selected post if it's the one being modified
        if (selectedPost && selectedPost._id === postId) {
          setSelectedPost(data.post);
        }
      }
    } catch (error) {
      console.error("Delete comment error:", error);
      setError(error.message || "Failed to delete comment");
    }
  };
  
  // Add function to handle post deletion
  const handleDeletePost = async (postId, e) => {
    if (!isModeratorOrAdmin()) return;
    
    // Stop event propagation to prevent post click
    e.stopPropagation();
    
    try {
      setError("");
      
      // Confirm deletion
      if (!window.confirm("Are you sure you want to delete this post?")) {
        return;
      }
      
      const response = await fetch(`http://localhost:5000/api/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to delete post");
      }
      
      // Remove the post from state
      const updatedPosts = posts.filter(post => post._id !== postId);
      setPosts(updatedPosts);
      
      // Clear selected post if it was deleted
      if (selectedPost && selectedPost._id === postId) {
        setSelectedPost(null);
      }
    } catch (error) {
      console.error("Delete post error:", error);
      setError(error.message || "Failed to delete post");
    }
  };

  // Update renderComment function to include delete button for moderators/admins
  const renderComment = (comment, post) => {
    return (
      <div style={{
        ...getCommentStyle(comment),
        marginBottom: "10px", 
        padding: "8px", 
        borderRadius: "4px",
        position: "relative" // For absolute positioning of delete button
      }}>
        {comment.isPinned && (
          <div style={pinnedBadgeStyle}>
            <span style={{ fontSize: '0.7em', fontWeight: 'bold' }}>PINNED</span>
          </div>
        )}
        
        {/* Delete button for moderators/admins */}
        {isModeratorOrAdmin() && activeTab === "community" && (
          <button 
            onClick={(e) => handleDeleteComment(post._id, comment._id, e)}
            style={{
              position: "absolute",
              top: "5px",
              right: "5px",
              background: "#ff4d4d",
              color: "white",
              border: "none",
              borderRadius: "3px",
              padding: "2px 6px",
              fontSize: "0.7em",
              cursor: "pointer"
            }}
          >
            Delete
          </button>
        )}
        
        <p style={{ margin: "0 0 5px 0" }}>{comment.text}</p>
        
        {comment.imagePath && (
          <div style={commentImageContainerStyle}>
            <img 
              src={`http://localhost:5000${comment.imagePath}`} 
              alt="Comment attachment" 
              style={commentImageStyle} 
              onClick={(e) => {
                e.stopPropagation();
                window.open(`http://localhost:5000${comment.imagePath}`, '_blank');
              }}
            />
          </div>
        )}
        
        <small style={{ color: "#6c757d" }}>
          By {comment.author} {getRoleBadge(post, comment.authorId)} • {formatDate(comment.createdAt)}
        </small>
      </div>
    );
  };

  if (isAuthenticated() && !hasLocation) {
    return (
      <div style={{ padding: '30px', textAlign: 'center' }}>
        <h2>Set Your Location</h2>
        <p>To see community posts near you, please set your location first.</p>
        <button 
          onClick={() => navigate('/settings')}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            marginTop: '15px'
          }}
        >
          Go to Location Settings
        </button>
      </div>
    );
  }

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
          <button 
            onClick={() => navigate('/report')}
            style={{
              display: "inline-block",
              padding: "8px 15px",
              backgroundColor: "#28a745",
              color: "white",
              borderRadius: "4px",
              border: "none",
              textDecoration: "none",
              fontWeight: "bold",
              cursor: "pointer"
            }}
          >
            Create New Post
          </button>
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
                posts.map((post) => {
                  // Find the user's vote for this post
                  let userVote = null;
                  if (user && post.votes) {
                    const found = post.votes.find(v => v.userId === user.id || v.userId === user._id);
                    if (found) userVote = found.voteType;
                  }
                  return (
                    <li key={post._id || post.id} style={{...postItemStyle, position: "relative"}} onClick={() => handlePostClick(post)}>
                      {/* Add delete button for posts if user is moderator/admin */}
                      {isModeratorOrAdmin() && (
                        <button 
                          onClick={(e) => handleDeletePost(post._id, e)}
                          style={{
                            position: "absolute",
                            top: "10px",
                            right: "10px",
                            background: "#ff4d4d",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            padding: "5px 10px",
                            cursor: "pointer",
                            zIndex: 5
                          }}
                        >
                          Delete Post
                        </button>
                      )}
                      
                      <h3 style={postTitleStyle}>{post.title}</h3>

                      <p style={postInfoStyle}>
                        Location: {post.location?.displayName || (post.location?.coordinates ? 
                          `${post.location.coordinates[1].toFixed(4)}, ${post.location.coordinates[0].toFixed(4)}` : 
                          "Unknown location")}
                      </p>

                      <p style={postInfoStyle}>Posted by: {post.author} • {formatDate(post.createdAt)}</p>
                      {post.description && <p style={{ margin: "10px 0" }}>{post.description}</p>}
                      
                      {/* Display post image if available */}
                      {post.imagePath && (
                        <div style={postImageContainerStyle}>
                          <img 
                            src={`http://localhost:5000${post.imagePath}`} 
                            alt="Report image" 
                            style={postImageStyle}
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`http://localhost:5000${post.imagePath}`, '_blank');
                            }}
                          />
                        </div>
                      )}
                      
                      <div style={voteContainerStyle}>
                        <button
                          style={{
                            ...voteButtonStyle,
                            backgroundColor: userVote === 'upvote' ? '#d4edda' : voteButtonStyle.backgroundColor,
                            color: userVote === 'upvote' ? '#155724' : voteButtonStyle.color,
                            fontWeight: userVote === 'upvote' ? 'bold' : 'normal',
                            cursor: userVote === 'upvote' ? 'not-allowed' : 'pointer',
                            opacity: userVote === 'upvote' ? 0.7 : 1
                          }}
                          onClick={e => {
                            e.stopPropagation();
                            if (userVote !== 'upvote') handleVote(post._id || post.id, 'upvote');
                          }}
                          disabled={userVote === 'upvote' || userLoading || !isAuthenticated()}
                        >
                          Upvote ({post.upvotes})
                        </button>
                        <button
                          style={{
                            ...voteButtonStyle,
                            backgroundColor: userVote === 'downvote' ? '#f8d7da' : voteButtonStyle.backgroundColor,
                            color: userVote === 'downvote' ? '#721c24' : voteButtonStyle.color,
                            fontWeight: userVote === 'downvote' ? 'bold' : 'normal',
                            cursor: userVote === 'downvote' ? 'not-allowed' : 'pointer',
                            opacity: userVote === 'downvote' ? 0.7 : 1
                          }}
                          onClick={e => {
                            e.stopPropagation();
                            if (userVote !== 'downvote') handleVote(post._id || post.id, 'downvote');
                          }}
                          disabled={userVote === 'downvote' || userLoading || !isAuthenticated()}
                        >
                          Downvote ({post.downvotes})
                        </button>
                      </div>
                      {selectedPost === post && (
                        <div style={commentSectionStyle} onClick={(e) => e.stopPropagation()}>
                          <h4>Comments</h4>
                          {post.comments && post.comments.length > 0 ? (
                            sortComments(post.comments).map((comment, index) => (
                              <div key={index}>
                                {renderComment(comment, post)}
                              </div>
                            ))
                          ) : (
                            <p>No comments yet.</p>
                          )}
                          
                          <div style={commentFormStyle}>
                            <textarea
                              placeholder="Add a comment..."
                              value={commentText}
                              onChange={(e) => setCommentText(e.target.value)}
                              style={commentInputStyle}
                              disabled={submittingComment || !isAuthenticated()}
                              onClick={(e) => e.stopPropagation()}
                            />
                            
                            {/* Image upload UI for comments */}
                            {isAuthenticated() && activeTab === "community" && (
                              <div style={imageUploadContainerStyle} onClick={(e) => e.stopPropagation()}>
                                {commentImagePreview ? (
                                  <div style={previewContainerStyle}>
                                    <img 
                                      src={commentImagePreview} 
                                      alt="Comment preview" 
                                      style={previewImageStyle} 
                                    />
                                    <button
                                      onClick={removeCommentImage}
                                      style={removeImageButtonStyle}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <div>
                                    <label htmlFor="comment-image-upload" style={uploadLabelStyle}>
                                      <span style={uploadIconStyle}>📷</span> Add Image
                                    </label>
                                    <input
                                      id="comment-image-upload"
                                      type="file"
                                      accept="image/*"
                                      onChange={handleCommentImageChange}
                                      style={hiddenInputStyle}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Show PIN option only for NGO users */}
                            {isAuthenticated() && user && user.role === 'ngo' && (
                              <div style={pinOptionStyle} onClick={(e) => e.stopPropagation()}>
                                <label>
                                  <input
                                    type="checkbox"
                                    checked={pinComment}
                                    onChange={(e) => setPinComment(e.target.checked)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  {' '} Pin this comment (visible to all users)
                                </label>
                              </div>
                            )}
                            
                            <div style={commentFormActionsStyle} onClick={(e) => e.stopPropagation()}>
                              {!isAuthenticated() && (
                                <small style={{ color: "#6c757d", marginRight: '10px' }}>
                                  <a href="/login" style={{ color: "#007bff", textDecoration: "none" }}>Log in</a> to comment
                                </small>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddComment(post._id || post.id);
                                }}
                                style={commentButtonStyle}
                                disabled={submittingComment || (!commentText.trim() && !commentImage) || !isAuthenticated()}
                              >
                                {submittingComment ? "Posting..." : "Post Comment"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </li>
                  )
                })
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
                      <div key={item.id} style={{...newsItemStyle, cursor: 'pointer'}} onClick={() => handlePostClick(item)}>
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
                            {/* Add special badge for weather alerts/NWS reports */}
                            {(item.isWeatherAlert || 
                              item.source === 'National Weather Service' || 
                              item.source?.includes('NWS') || 
                              (item.title?.includes('issued') && item.title?.includes('NWS'))) && (
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
                            <span style={sourceStyle}>Source: {item.source}</span>
                            <span style={dateStyle}>{formatDate(item.publicationDate || item.publishedAt || item.createdAt)}</span>
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
                              onClick={(e) => e.stopPropagation()}
                            >
                              Read Full Article
                            </a>
                          )}
                          
                          {/* Comment section for news items when clicked */}
                          {selectedPost === item && (
                            <div style={commentSectionStyle} onClick={(e) => e.stopPropagation()}>
                              <h4>NGO Assistance Comments</h4>
                              <p style={{fontStyle: 'italic', color: '#666', fontSize: '0.9em', marginBottom: '15px'}}>
                                This section allows NGOs and organizations to comment on how they can help in this disaster area.
                              </p>
                              
                              {item.comments && item.comments.length > 0 ? (
                                sortComments(item.comments).map((comment, index) => (
                                  <div key={index} style={{
                                    ...getCommentStyle(comment),
                                    marginBottom: "10px", 
                                    padding: "8px", 
                                    borderRadius: "4px"
                                  }}>
                                    {comment.isPinned && (
                                      <div style={pinnedBadgeStyle}>
                                        <span style={{ fontSize: '0.7em', fontWeight: 'bold' }}>PINNED</span>
                                      </div>
                                    )}
                                    <p style={{ margin: "0 0 5px 0" }}>{comment.text}</p>
                                    <small style={{ color: "#6c757d" }}>
                                      By {comment.author} {getRoleBadge(item, comment.authorId)} • {formatDate(comment.createdAt)}
                                    </small>
                                  </div>
                                ))
                              ) : (
                                <p>No NGO assistance comments yet.</p>
                              )}
                              
                              {/* Only show comment form for NGOs */}
                              {/* {isAuthenticated() && user && user.role === 'ngo' ? (
                                <div style={commentFormStyle}>
                                  <textarea
                                    placeholder="As an NGO, describe how you can help in this disaster area..."
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    style={commentInputStyle}
                                    disabled={submittingComment}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  
                                  <div style={pinOptionStyle} onClick={(e) => e.stopPropagation()}>
                                    <label>
                                      <input
                                        type="checkbox"
                                        checked={pinComment}
                                        onChange={(e) => setPinComment(e.target.checked)}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      {' '} Pin this comment (visible to all users)
                                    </label>
                                  </div>
                                  
                                  <div style={commentFormActionsStyle} onClick={(e) => e.stopPropagation()}>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAddComment(item.id);
                                      }}
                                      style={commentButtonStyle}
                                      disabled={submittingComment || !commentText.trim()}
                                    >
                                      {submittingComment ? "Posting..." : "Post Comment"}
                                    </button>
                                  </div>
                                </div>
                              ) : ( */}
                                <div style={{backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '5px', marginTop: '15px'}}>
                                  <p style={{margin: 0}}>
                                    Commenting on news items has been temporarily disabled.
                                    {/* Only NGO/Organization accounts can comment on news items to provide assistance information.
                                    {!isAuthenticated() && (
                                      <span> Please <a href="/login" style={{color: '#007bff', textDecoration: 'none'}}>log in</a> if you represent an NGO.</span>
                                    )} */}
                                  </p>
                                </div>
                              {/* )} */}
                            </div>
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
  padding: "15px",
  backgroundColor: "white",
  borderRadius: "4px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
}

const commentFormStyle = {
  marginTop: "15px",
  display: "flex",
  flexDirection: "column",
}

const commentInputStyle = {
  padding: "10px",
  borderRadius: "4px",
  border: "1px solid #ddd",
  minHeight: "80px",
  resize: "vertical",
  marginBottom: "10px",
  fontFamily: "inherit",
}

const commentFormActionsStyle = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
}

const commentButtonStyle = {
  padding: "8px 15px",
  backgroundColor: "#007bff",
  color: "white",
  border: "none",
  borderRadius: "4px",
  cursor: "pointer",
  fontWeight: "bold",
  disabled: {
    backgroundColor: "#cccccc",
    cursor: "not-allowed",
  }
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

// Add styles for pinned comments
const pinnedBadgeStyle = {
  backgroundColor: '#28a745',
  color: 'white',
  padding: '2px 6px',
  borderRadius: '3px',
  display: 'inline-block',
  marginBottom: '5px'
};

const pinOptionStyle = {
  marginBottom: '10px',
  display: 'flex',
  alignItems: 'center'
};

// Add styles for image attachments
const imageUploadContainerStyle = {
  marginBottom: '10px',
};

const uploadLabelStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '8px 12px',
  backgroundColor: '#f0f0f0',
  borderRadius: '4px',
  cursor: 'pointer',
  marginTop: '5px',
  marginBottom: '10px',
  border: '1px solid #ddd',
};

const uploadIconStyle = {
  marginRight: '8px',
  fontSize: '16px',
};

const hiddenInputStyle = {
  display: 'none',
};

const previewContainerStyle = {
  position: 'relative',
  marginTop: '10px',
  marginBottom: '10px',
  maxWidth: '200px',
  border: '1px solid #ddd',
  borderRadius: '4px',
  overflow: 'hidden',
};

const previewImageStyle = {
  width: '100%',
  display: 'block',
};

const removeImageButtonStyle = {
  position: 'absolute',
  top: '5px',
  right: '5px',
  width: '24px',
  height: '24px',
  borderRadius: '50%',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  color: 'white',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '12px',
};

const commentImageContainerStyle = {
  marginTop: '8px',
  marginBottom: '8px',
};

const commentImageStyle = {
  maxWidth: '100%',
  maxHeight: '200px',
  borderRadius: '4px',
  cursor: 'pointer',
};

// Add new styles for post images
const postImageContainerStyle = {
  marginTop: '10px',
  marginBottom: '15px',
  maxWidth: '100%',
  textAlign: 'center',
};

const postImageStyle = {
  maxWidth: '100%',
  maxHeight: '300px',
  borderRadius: '4px',
  cursor: 'pointer',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
};

export default Posts