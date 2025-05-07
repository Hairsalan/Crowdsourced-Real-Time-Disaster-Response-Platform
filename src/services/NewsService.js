// NewsService.js - Handles fetching and processing disaster news

import { getStoredLocation, calculateDistance } from './LocationService';

// NWS API endpoint for active alerts
const NWS_API_URL = 'https://api.weather.gov/alerts/active';

// USGS Earthquake API endpoints
const USGS_API_URL_DAY = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';
const USGS_API_URL_WEEK = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson';

// Get disaster alerts by combining data from NWS and USGS APIs
export const getDisasterAlerts = async (customRadius = null, token = null) => {
  try {
    // Get alerts from both APIs
    const [weatherAlerts, earthquakeAlerts] = await Promise.all([
      fetchNWSAlerts(),
      fetchUSGSEarthquakes()
    ]);
    
    // Combine all alerts
    const allAlerts = [...weatherAlerts, ...earthquakeAlerts];
    
    // Filter alerts by user radius
    const filteredAlerts = filterAlertsByRadius(allAlerts, customRadius, token);
    
    return filteredAlerts;
  } catch (error) {
    console.error('Error fetching disaster alerts:', error);
    return [];
  }
};

// Fetch news about disasters (combines NWS and USGS data)
export const getDisasterNews = async (customRadius = null, token = null) => {
  console.log("getDisasterNews called with radius:", customRadius);
  
  try {
    // This now just calls getDisasterAlerts as we're using the same data sources
    const alerts = await getDisasterAlerts(customRadius, token);
    console.log("Disaster alerts fetched:", alerts.length);
    
    return alerts;
  } catch (error) {
    console.error('Error fetching disaster news:', error);
    return [];
  }
};

// Fetch alerts from National Weather Service API
const fetchNWSAlerts = async () => {
  try {
    const userLocation = getStoredLocation();
    let url = `${NWS_API_URL}`;
    
    // If we have user location, we could filter by area in a future enhancement
    // For now, we'll fetch all active alerts and filter by distance later
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/geo+json',
        'User-Agent': '(DisasterResponseApp, contact@example.com)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch NWS alerts: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Parse NWS alerts into our standard format
    return data.features.map(feature => {
      const properties = feature.properties;
      const geometry = feature.geometry;
      
      // Extract coordinates from geometry if available
      let latitude = null;
      let longitude = null;
      
      if (geometry && geometry.type === 'Point') {
        // For Point, coordinates are [longitude, latitude]
        longitude = geometry.coordinates[0];
        latitude = geometry.coordinates[1];
      } else if (geometry && geometry.type === 'Polygon') {
        // For Polygon, use the center point of the first ring
        // This is a simplification - could be improved in a future version
        const coordinates = geometry.coordinates[0];
        let latSum = 0;
        let lonSum = 0;
        
        coordinates.forEach(coord => {
          lonSum += coord[0];
          latSum += coord[1];
        });
        
        longitude = lonSum / coordinates.length;
        latitude = latSum / coordinates.length;
      }
      
      // Calculate distance if coordinates are available
      const distance = calculateDistanceToUser(latitude, longitude);
      
      return {
        id: properties.id,
        title: properties.headline || properties.event,
        description: properties.description,
        link: properties.url,
        publicationDate: properties.sent,
        category: properties.event,
        severity: properties.severity,
        certainty: properties.certainty,
        urgency: properties.urgency,
        source: 'National Weather Service',
        latitude,
        longitude,
        distance
      };
    });
  } catch (error) {
    console.error('Error fetching NWS alerts:', error);
    return [];
  }
};

// Fetch earthquake data from USGS API
const fetchUSGSEarthquakes = async () => {
  try {
    // Use the past day endpoint by default
    const response = await fetch(USGS_API_URL_DAY);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch USGS earthquakes: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Parse USGS data into our standard format and filter out micro earthquakes
    return data.features
      .filter(feature => feature.properties.mag >= 2.5) // Filter out micro earthquakes
      .map(feature => {
        const properties = feature.properties;
        const geometry = feature.geometry;
        
        // Get coordinates (USGS GeoJSON uses [longitude, latitude, depth])
        const longitude = geometry.coordinates[0];
        const latitude = geometry.coordinates[1];
        const depth = geometry.coordinates[2];
        
        // Calculate magnitude category
        let category = 'Earthquake';
        if (properties.mag >= 7) {
          category = 'Major Earthquake';
        } else if (properties.mag >= 5) {
          category = 'Moderate Earthquake';
        } else if (properties.mag >= 2.5) {
          category = 'Minor Earthquake';
        }
        
        // Calculate severity based on magnitude
        let severity = 'Unknown';
        if (properties.mag >= 7) {
          severity = 'Extreme';
        } else if (properties.mag >= 5) {
          severity = 'Severe';
        } else if (properties.mag >= 3) {
          severity = 'Moderate';
        } else {
          severity = 'Minor';
        }
        
        // Calculate distance if coordinates are available
        const distance = calculateDistanceToUser(latitude, longitude);
        
        // Format description with magnitude and depth
        const description = `Magnitude ${properties.mag} earthquake at a depth of ${depth.toFixed(1)} km. ${properties.place}.`;
        
        return {
          id: properties.ids || feature.id,
          title: `M${properties.mag.toFixed(1)} - ${properties.place}`,
          description,
          link: properties.url,
          publicationDate: new Date(properties.time).toISOString(),
          category,
          severity,
          source: 'USGS Earthquake Hazards Program',
          latitude,
          longitude,
          depth,
          magnitude: properties.mag,
          distance,
          imageUrl: null
        };
      });
  } catch (error) {
    console.error('Error fetching USGS earthquakes:', error);
    return [];
  }
};

// Filter alerts by user's radius
const filterAlertsByRadius = (alerts, customRadius = null, token = null) => {
  const userLocation = getStoredLocation();
  
  // If no user location, return all alerts
  if (!userLocation || !userLocation.latitude || !userLocation.longitude) {
    return alerts;
  }
  
  // Get user's preferred radius (use custom radius if provided)
  const radiusMiles = customRadius !== null ? customRadius : (userLocation.radiusMiles || 50);
  
  console.log(`Filtering ${alerts.length} alerts within ${radiusMiles} miles of user location [${userLocation.latitude}, ${userLocation.longitude}]`);
  
  // Filter alerts within the radius
  const filteredAlerts = alerts.filter(alert => {
    // Skip alerts without coordinates
    if (!alert.latitude || !alert.longitude) {
      return false;
    }
    
    // Parse coordinates as floats to ensure they're numbers
    const alertLat = parseFloat(alert.latitude);
    const alertLng = parseFloat(alert.longitude);
    
    if (isNaN(alertLat) || isNaN(alertLng)) {
      return false;
    }
    
    // Calculate distance using Haversine formula (same as in server)
    const R = 6371; // Earth's radius in km
    const dLat = (alertLat - userLocation.latitude) * Math.PI / 180;
    const dLon = (alertLng - userLocation.longitude) * Math.PI / 180;
    const lat1 = userLocation.latitude * Math.PI / 180;
    const lat2 = alertLat * Math.PI / 180;
    
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1) * Math.cos(lat2) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distanceKm = R * c;
    const distanceMiles = distanceKm * 0.621371;
    
    // Add distance to alert object
    alert.distance = distanceMiles;
    
    // Add a type property to help with filtering in the Map component
    alert.type = 'news';
    
    // Include if within radius
    return distanceMiles <= radiusMiles;
  });
  
  console.log(`Filtered ${alerts.length} alerts down to ${filteredAlerts.length} within ${radiusMiles} miles`);
  
  return filteredAlerts;
};

// Calculate distance between disaster and user location
const calculateDistanceToUser = (latitude, longitude) => {
  if (!latitude || !longitude) return null;
  
  const userLocation = getStoredLocation();
  if (!userLocation?.latitude || !userLocation?.longitude) return null;
  
  return calculateDistance(
    userLocation.latitude, 
    userLocation.longitude,
    latitude, 
    longitude
  );
};