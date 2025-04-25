// NewsService.js - Handles fetching and processing disaster news

import { getStoredLocation, calculateDistance } from './LocationService';

// GDACS API for global disaster alerts
const GDACS_API_URL = 'https://www.gdacs.org/xml/rss.xml';

// News API for news articles (you would need an API key)
// Free alternative: https://newsapi.org/ 
const NEWS_API_KEY = 'YOUR_API_KEY'; // Replace with your actual API key
const NEWS_API_URL = `https://newsapi.org/v2/everything?apiKey=${NEWS_API_KEY}`;

// Disaster keywords for searching news
const DISASTER_KEYWORDS = [
  'earthquake', 'flood', 'hurricane', 'tornado', 'tsunami', 
  'wildfire', 'drought', 'landslide', 'volcano', 'cyclone', 
  'typhoon', 'disaster', 'emergency', 'evacuation'
];

// Get disaster alerts from GDACS (Global Disaster Alert and Coordination System)
export const getDisasterAlerts = async (customRadius = null, token = null) => {
  try {
    // For development, return dummy data instead of making API calls
    // In production, you would uncomment the API call below
    /*
    // Use a CORS proxy if needed
    const corsProxy = 'https://cors-anywhere.herokuapp.com/';
    const response = await fetch(corsProxy + GDACS_API_URL);
    
    if (!response.ok) {
      throw new Error('Failed to fetch disaster alerts');
    }
    
    const text = await response.text();
    // Parse XML response
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, 'text/xml');
    
    // Extract disaster information from XML
    const items = xmlDoc.querySelectorAll('item');
    const allAlerts = Array.from(items).map(item => {
      // Extract coordinates from GeoRSS point
      const point = item.getElementsByTagNameNS('http://www.georss.org/georss', 'point')[0]?.textContent;
      let latitude = null;
      let longitude = null;
      
      if (point) {
        const coords = point.split(' ');
        latitude = parseFloat(coords[0]);
        longitude = parseFloat(coords[1]);
      }
      
      return {
        id: item.querySelector('guid')?.textContent,
        title: item.querySelector('title')?.textContent,
        description: item.querySelector('description')?.textContent,
        link: item.querySelector('link')?.textContent,
        publicationDate: new Date(item.querySelector('pubDate')?.textContent).toISOString(),
        category: item.querySelector('category')?.textContent || 'Unknown',
        latitude,
        longitude,
        // Calculate distance if user location is available
        distance: calculateDistanceToUser(latitude, longitude)
      };
    });
    
    // Filter alerts by user radius
    const alerts = filterAlertsByRadius(allAlerts, customRadius, token);
    
    return alerts;
    */
    
    // Return dummy data for development
    const allAlerts = getDummyDisasterAlerts();
    
    // Filter alerts by user radius
    const alerts = filterAlertsByRadius(allAlerts, customRadius, token);
    
    return alerts;
  } catch (error) {
    console.error('Error fetching disaster alerts:', error);
    // Return dummy data as fallback
    const allAlerts = getDummyDisasterAlerts();
    const alerts = filterAlertsByRadius(allAlerts, customRadius, token);
    return alerts;
  }
};

// Fetch news about disasters (requires News API key)
export const getDisasterNews = async (customRadius = null, token = null) => {
  try {
    // Get user's location from the context or localStorage
    const userLocation = getStoredLocation();
    
    // For development, return dummy data instead of making API calls
    // In production, you would uncomment the API call below
    /*
    // Create a query with disaster keywords
    const keywords = DISASTER_KEYWORDS.join(' OR ');
    
    // Include location in query if available
    let url = `${NEWS_API_URL}&q=${keywords}&sortBy=publishedAt&language=en`;
    
    if (userLocation?.displayName) {
      // Extract relevant location information
      const locationTerms = extractLocationTerms(userLocation.displayName);
      if (locationTerms) {
        url += `&q=${keywords} AND ${locationTerms}`;
      }
    }
    
    // Add authorization if token exists
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error('Failed to fetch news');
    }
    
    const data = await response.json();
    
    // Process news articles
    const allNews = data.articles.map(article => ({
      id: article.url,
      title: article.title,
      description: article.description,
      content: article.content,
      source: article.source.name,
      url: article.url,
      imageUrl: article.urlToImage,
      publishedAt: article.publishedAt,
      type: 'news'
    }));
    
    // Filter news by user radius
    const filteredNews = filterNewsByRadius(allNews, customRadius, token);
    
    return filteredNews;
    */
    
    // Return dummy data for development
    const allNews = getDummyDisasterNews();
    
    // Filter news by user radius
    const filteredNews = filterNewsByRadius(allNews, customRadius, token);
    
    return filteredNews;
  } catch (error) {
    console.error('Error fetching disaster news:', error);
    
    // Return dummy data if API fails or is not set up
    const allNews = getDummyDisasterNews();
    const filteredNews = filterNewsByRadius(allNews, customRadius, token);
    return filteredNews;
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
  
  console.log(`Filtering alerts within ${radiusMiles} miles of user location [${userLocation.latitude}, ${userLocation.longitude}]`);
  
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
      console.warn("Invalid coordinates for alert:", alert.title);
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
    
    console.log(`Alert "${alert.title}" at [${alertLat}, ${alertLng}] is ${distanceMiles.toFixed(2)} miles from user location`);
    
    // Include if within radius
    return distanceMiles <= radiusMiles;
  });
  
  console.log(`Filtered ${alerts.length} alerts down to ${filteredAlerts.length} within ${radiusMiles} miles`);
  
  return filteredAlerts;
};

// Filter news by user's radius (based on keywords/location terms for API results)
const filterNewsByRadius = (news, customRadius = null, token = null) => {
  // Get user's location from localStorage
  const userLocation = getStoredLocation();
  
  // If no user location, return all news
  if (!userLocation || !userLocation.latitude || !userLocation.longitude) {
    return news;
  }
  
  // If there's a valid token, use server-side filtering
  if (token) {
    // In production, you would make a call to the server for filtering
    // For now, just use client-side filtering
  }
  
  // Get user's preferred radius (use custom radius if provided)
  const radiusMiles = customRadius !== null ? customRadius : (userLocation.radiusMiles || 50);
  
  console.log(`Filtering news within ${radiusMiles} miles of user location`);
  
  // Filter news by their distance property
  // We now calculate actual distances for each item using the Haversine formula
  // based on the user's current location and the item's coordinates
  const filteredNews = news.filter(item => {
    // Ensure item has a distance value
    if (typeof item.distance === 'undefined') {
      console.warn(`News item "${item.title}" missing distance information`);
      return false;
    }
    
    console.log(`News item "${item.title}" is ${item.distance.toFixed(1)} miles from user location (radius: ${radiusMiles})`);
    return item.distance <= radiusMiles;
  });
  
  console.log(`Filtered ${news.length} news items down to ${filteredNews.length} within ${radiusMiles} miles`);
  
  return filteredNews;
};

// Extract relevant location terms for better news filtering
const extractLocationTerms = (displayName) => {
  if (!displayName) return null;
  
  // Extract city, state, country, etc.
  const parts = displayName.split(',').map(part => part.trim());
  
  // Filter out postal codes and very short terms
  const relevantParts = parts.filter(part => {
    const isPostalCode = /^\d+$/.test(part);
    return !isPostalCode && part.length > 2;
  });
  
  // Return most specific terms (city, county, etc.)
  return relevantParts.slice(0, 2).join(' OR ');
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

// Get dummy disaster alerts for testing
const getDummyDisasterAlerts = () => {
  const userLocation = getStoredLocation();
  const calculateRealDistance = (lat, lng) => {
    if (!userLocation || !userLocation.latitude || !userLocation.longitude) {
      return 1000; // Default large distance if no user location
    }
    return calculateDistance(userLocation.latitude, userLocation.longitude, lat, lng);
  };

  const dummyAlerts = [
    {
      id: 'eq-2023-03-15-turkey',
      title: 'Magnitude 5.6 Earthquake in Turkey',
      description: 'A magnitude 5.6 earthquake occurred in eastern Turkey. No major damage reported.',
      link: 'https://example.com/earthquake-turkey',
      publicationDate: '2023-03-15T08:34:21Z',
      category: 'Earthquake',
      latitude: 38.7223,
      longitude: 43.4801
    },
    {
      id: 'fl-2023-03-14-italy',
      title: 'Flooding in Northern Italy',
      description: 'Heavy rainfall has caused significant flooding in several northern Italian cities.',
      link: 'https://example.com/flooding-italy',
      publicationDate: '2023-03-14T16:45:00Z',
      category: 'Flood',
      latitude: 45.4654,
      longitude: 9.1859
    },
    {
      id: 'wf-2023-03-13-california',
      title: 'Wildfire in Southern California',
      description: 'A fast-moving wildfire has burned over 500 acres in San Bernardino County.',
      link: 'https://example.com/wildfire-california',
      publicationDate: '2023-03-13T21:15:33Z',
      category: 'Wildfire',
      latitude: 34.1083,
      longitude: -117.2898
    },
    {
      id: 'tc-2023-03-12-fiji',
      title: 'Tropical Cyclone Approaching Fiji',
      description: 'A category 3 tropical cyclone is expected to make landfall in Fiji within 48 hours.',
      link: 'https://example.com/cyclone-fiji',
      publicationDate: '2023-03-12T09:30:15Z',
      category: 'Tropical Cyclone',
      latitude: -17.7134,
      longitude: 178.0650
    },
    {
      id: 'dr-2023-03-11-ethiopia',
      title: 'Drought Conditions Worsen in Ethiopia',
      description: 'Eastern regions of Ethiopia are experiencing severe drought conditions affecting crop yields.',
      link: 'https://example.com/drought-ethiopia',
      publicationDate: '2023-03-11T14:20:45Z',
      category: 'Drought',
      latitude: 9.1450,
      longitude: 40.4897
    },
    {
      id: 'ls-2023-03-10-nepal',
      title: 'Landslide in Central Nepal',
      description: 'A landslide has blocked a major highway in central Nepal following heavy rainfall.',
      link: 'https://example.com/landslide-nepal',
      publicationDate: '2023-03-10T11:05:38Z',
      category: 'Landslide',
      latitude: 27.7172,
      longitude: 85.3240
    }
  ];

  // Calculate real distances based on user location
  return dummyAlerts.map(alert => ({
    ...alert,
    distance: calculateRealDistance(alert.latitude, alert.longitude)
  }));
};

// Fallback: Get dummy disaster news for testing
const getDummyDisasterNews = () => {
  const userLocation = getStoredLocation();
  const calculateRealDistance = (lat, lng) => {
    if (!userLocation || !userLocation.latitude || !userLocation.longitude) {
      return 1000; // Default large distance if no user location
    }
    return calculateDistance(userLocation.latitude, userLocation.longitude, lat, lng);
  };

  const dummyNews = [
    {
      id: '1',
      title: 'Severe Flooding Affects Coastal Regions',
      description: 'Heavy rainfall has caused significant flooding in coastal areas, with emergency services conducting evacuations.',
      content: 'Rising water levels have forced hundreds of residents to evacuate their homes as emergency services work to mitigate the damage...',
      source: 'Weather Alert Network',
      url: '#',
      imageUrl: 'https://via.placeholder.com/400x200?text=Flooding',
      publishedAt: '2023-03-13T08:30:00Z',
      type: 'disaster',
      category: 'flood',
      latitude: 37.7749,
      longitude: -122.4194
    },
    {
      id: '2',
      title: 'Magnitude 5.8 Earthquake Reported',
      description: 'A moderate earthquake was detected early this morning. No major damage has been reported.',
      content: 'Geological Survey confirms a magnitude 5.8 earthquake occurred at approximately 3:45 AM local time. The epicenter was located about 20 miles offshore...',
      source: 'Geological Monitor',
      url: '#',
      imageUrl: 'https://via.placeholder.com/400x200?text=Earthquake',
      publishedAt: '2023-03-12T15:45:00Z',
      type: 'disaster',
      category: 'earthquake',
      latitude: 37.8044,
      longitude: -122.2712
    },
    {
      id: '3',
      title: 'Wildfire Contained After Three Days',
      description: 'Firefighters have successfully contained the wildfire that threatened several communities.',
      content: 'After three days of continuous efforts, fire departments from three counties have managed to contain the wildfire that burned through approximately 500 acres...',
      source: 'Emergency Response Daily',
      url: '#',
      imageUrl: 'https://via.placeholder.com/400x200?text=Wildfire',
      publishedAt: '2023-03-11T19:15:00Z',
      type: 'disaster',
      category: 'wildfire',
      latitude: 38.5816,
      longitude: -121.4944
    },
    {
      id: '4',
      title: 'Hurricane Warning Issued for Coastal Areas',
      description: 'Meteorologists have issued a hurricane warning as a strong storm system approaches the coast.',
      content: 'Residents in coastal areas are advised to prepare for strong winds and heavy rainfall as Hurricane Laura approaches...',
      source: 'National Weather Center',
      url: '#',
      imageUrl: 'https://via.placeholder.com/400x200?text=Hurricane',
      publishedAt: '2023-03-10T12:30:00Z',
      type: 'disaster',
      category: 'hurricane',
      latitude: 27.9506,
      longitude: -82.4572
    },
    {
      id: '5',
      title: 'Tornado Touches Down in Midwest',
      description: 'A tornado briefly touched down in rural areas, causing minimal damage to structures.',
      content: 'Weather services confirmed a small tornado touched down for approximately three minutes, damaging several farm buildings but causing no injuries...',
      source: 'Storm Tracker News',
      url: '#',
      imageUrl: 'https://via.placeholder.com/400x200?text=Tornado',
      publishedAt: '2023-03-09T16:45:00Z',
      type: 'disaster',
      category: 'tornado',
      latitude: 41.8781, // Chicago coordinates
      longitude: -87.6298
    }
  ];

  // Calculate real distances based on user location
  return dummyNews.map(news => ({
    ...news,
    distance: calculateRealDistance(news.latitude, news.longitude)
  }));
};