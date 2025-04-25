// ReportService.js - Handles community disaster reports

import { getStoredLocation, calculateDistance } from './LocationService';

/**
 * Get community reports within a specified radius
 * @param {number} customRadius - Optional custom radius to override user's default
 * @param {string} token - Authentication token
 * @returns {Promise<Array>} - Array of community reports
 */
export const getCommunityReports = async (customRadius = null, token = null) => {
  try {
    // In a production app, this would make an API call to the server
    // For now, we'll fetch from the internal API endpoint
    if (!token) {
      console.warn('No authentication token provided for fetching reports');
      return [];
    }
    
    const response = await fetch(`http://localhost:5000/api/posts?radius=${customRadius || 50}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch community reports');
    }
    
    const reports = await response.json();
    
    // If a custom radius was specified that differs from the server request,
    // filter the results client-side as well to ensure consistency
    const userLocation = getStoredLocation();
    if (userLocation && customRadius !== null) {
      return filterReportsByRadius(reports, customRadius);
    }
    
    return reports;
  } catch (error) {
    console.error('Error fetching community reports:', error);
    return [];
  }
};

/**
 * Filter reports by distance from user's location
 * @param {Array} reports - Array of community reports
 * @param {number} customRadius - Radius in miles
 * @returns {Array} - Filtered array of reports
 */
const filterReportsByRadius = (reports, customRadius) => {
  const userLocation = getStoredLocation();
  
  // If no user location, return all reports
  if (!userLocation || !userLocation.latitude || !userLocation.longitude) {
    return reports;
  }
  
  // Get user's preferred radius (use custom radius if provided)
  const radiusMiles = customRadius || (userLocation.radiusMiles || 50);
  
  console.log(`Filtering ${reports.length} reports within ${radiusMiles} miles of user location`);
  
  // Filter reports by distance
  return reports.filter(report => {
    // Skip reports without location
    if (!report.location || !report.location.latitude || !report.location.longitude) {
      return false;
    }
    
    // Calculate distance using the Haversine formula
    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      report.location.latitude,
      report.location.longitude
    );
    
    // Add distance to report object for UI display
    report.distance = distance;
    
    // Include if within radius
    return distance <= radiusMiles;
  });
};

/**
 * Create a new community report
 * @param {Object} reportData - Report data to submit
 * @param {string} token - Authentication token
 * @returns {Promise<Object>} - Created report
 */
export const createReport = async (reportData, token) => {
  try {
    if (!token) {
      throw new Error('Authentication required to create reports');
    }
    
    const response = await fetch('http://localhost:5000/api/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(reportData)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to create report');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error creating report:', error);
    throw error;
  }
}; 