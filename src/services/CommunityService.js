// CommunityService.js - Handles community interaction features

import { getStoredLocation } from './LocationService';
import { getCommunityReports } from './ReportService';

/**
 * Get all posts (community reports and news) within a radius
 * @param {number} customRadius - Optional custom radius to override user's default
 * @param {string} token - Authentication token
 * @returns {Promise<Array>} - Array of posts
 */
export const getAllPosts = async (customRadius = null, token = null) => {
  try {
    // Get community reports
    const reports = await getCommunityReports(customRadius, token);
    
    // In a real app, you might fetch from a dedicated endpoint that combines
    // both reports and news, but for now we'll use separate sources
    const userLocation = getStoredLocation();
    const radiusMiles = customRadius !== null ? customRadius : (userLocation?.radiusMiles || 50);
    
    console.log(`Getting all posts within ${radiusMiles} miles`);
    
    // Return combined results
    return reports;
  } catch (error) {
    console.error('Error fetching all posts:', error);
    return [];
  }
};

/**
 * Like/unlike a community post
 * @param {string} postId - ID of the post to like/unlike
 * @param {boolean} like - Whether to like (true) or unlike (false)
 * @param {string} token - Authentication token
 * @returns {Promise<Object>} - Updated post data
 */
export const toggleLikePost = async (postId, like, token) => {
  try {
    if (!token) {
      throw new Error('Authentication required to like posts');
    }
    
    const method = like ? 'POST' : 'DELETE';
    const response = await fetch(`http://localhost:5000/api/posts/${postId}/like`, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to update like status');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error toggling like:', error);
    throw error;
  }
};

/**
 * Add a comment to a post
 * @param {string} postId - ID of the post to comment on
 * @param {string} comment - Comment text
 * @param {string} token - Authentication token
 * @returns {Promise<Object>} - Updated post with the new comment
 */
export const addComment = async (postId, comment, token) => {
  try {
    if (!token) {
      throw new Error('Authentication required to comment');
    }
    
    const response = await fetch(`http://localhost:5000/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ text: comment })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to add comment');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error adding comment:', error);
    throw error;
  }
}; 