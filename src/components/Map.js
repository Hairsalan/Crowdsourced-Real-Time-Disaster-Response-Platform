import React, { useState, useEffect, useCallback, useMemo } from "react";
import { GoogleMap, useLoadScript, Marker, InfoWindow, Circle } from "@react-google-maps/api";
import { useAuth } from "../AuthContext";
import ErrorBoundary from "./ErrorBoundary";
import { getDisasterNews } from "../services/NewsService";

// Replace with your Google Maps API key
const GOOGLE_MAPS_API_KEY = "AIzaSyBAiCDlrLRdS1WsK8Utj9kVLFbjiun7PkU";

const mapContainerStyle = {
  width: "100%",
  height: "400px",
  borderRadius: "5px",
  marginBottom: "20px",
};

// URL for the current location marker
const CURRENT_LOCATION_MARKER = "https://maps.google.com/mapfiles/ms/icons/blue-dot.png";

// This helps prevent unnecessary re-renders of the Map component
const Map = React.memo(function Map() {
  // Map state
  const [center, setCenter] = useState({
    lat: 40.7128, // Default to New York
    lng: -74.0060,
  });
  const [location, setLocation] = useState(null);
  const [mapRef, setMapRef] = useState(null);
  
  // Data state
  const [alerts, setAlerts] = useState([]);
  const [userReports, setUserReports] = useState([]);
  const [newsItems, setNewsItems] = useState([]);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDisaster, setSelectedDisaster] = useState(null);
  const [showUserReports, setShowUserReports] = useState(true);
  const [showNewsItems, setShowNewsItems] = useState(true);
  // New state for tab control
  const [activeTab, setActiveTab] = useState("community");

  // Get location and radius update function from auth context
  const { userLocation, updateUserRadius } = useAuth();

  // Load the Google Maps Script
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  // Format the disaster data for display
  const formatDisasterData = useCallback((disaster, isUserReport = false, isNewsItem = false) => {
    console.log("formatDisasterData called with:", {
      title: disaster.title,
      isUserReport: isUserReport,
      isNewsItem: isNewsItem,
      type: disaster.type,
      source: disaster.source,
      hasLocation: disaster.location ? "yes" : "no",
      hasCoordinates: disaster.location?.coordinates ? "yes" : "no",
      // Debug news item specific fields
      latitude: disaster.latitude,
      longitude: disaster.longitude,
      publishedAt: disaster.publishedAt,
      category: disaster.category
    });
    
    // Ensure we're processing the correct type of data
    if (isNewsItem && !isUserReport) {
      // For news items from the API, we need additional checks
      if (!disaster || !disaster.title) {
        console.log("- News item is missing title");
        return null;
      }
      
      // Check if we have lat/lng either directly or in a location object
      let latitude, longitude;
      
      if (disaster.latitude && disaster.longitude) {
        // Direct latitude/longitude properties
        latitude = parseFloat(disaster.latitude);
        longitude = parseFloat(disaster.longitude);
        console.log(`Using direct lat/lng: ${latitude}, ${longitude}`);
      } else if (disaster.location && disaster.location.coordinates && disaster.location.coordinates.length === 2) {
        // MongoDB GeoJSON format
        longitude = parseFloat(disaster.location.coordinates[0]);
        latitude = parseFloat(disaster.location.coordinates[1]);
        console.log(`Using location.coordinates: ${latitude}, ${longitude}`);
      } else {
        console.log("- News item has no valid coordinates");
        return null;
      }
      
      // Validate coordinates
      if (isNaN(latitude) || isNaN(longitude)) {
        console.log("- News item has invalid coordinates, returning null");
        return null;
      }
      
      // Special debug for NWS vs Earthquake items
      if (disaster.source?.includes('NWS') || disaster.title?.includes('NWS')) {
        console.log("*** Processing NWS ITEM ***", {
          title: disaster.title,
          source: disaster.source,
          hasCoordinates: disaster.location?.coordinates ? "yes" : "no",
          coordinates: disaster.location?.coordinates || [disaster.longitude, disaster.latitude]
        });
      } else if (disaster.source?.includes('USGS') || disaster.title?.includes('Earthquake')) {
        console.log("*** Processing EARTHQUAKE ITEM ***", {
          title: disaster.title,
          source: disaster.source,
          hasCoordinates: disaster.location?.coordinates ? "yes" : "no"
        });
      }
      
      return {
        id: disaster.id || disaster._id,
        title: disaster.title,
        description: disaster.description,
        latitude: latitude,
        longitude: longitude,
        category: disaster.category || "news",
        publicationDate: disaster.publishedAt || disaster.createdAt,
        link: disaster.url || disaster.link || null,
        author: disaster.source || disaster.author || "News Source",
        source: disaster.source,
        isUserReport: false,
        isNewsItem: true,
        displayName: disaster.location?.displayName || null,
        imageUrl: disaster.imageUrl
      };
    } else if (isUserReport && !isNewsItem) {
      // User report (MongoDB GeoJSON format)
      const coordinates = disaster.location?.coordinates || [];
      // Ensure coordinates exist and have valid length
      if (!coordinates || coordinates.length < 2) {
        console.log("- Community report missing coordinates, returning null");
        return null;
      }
      
      const longitude = coordinates[0]; // GeoJSON format is [longitude, latitude]
      const latitude = coordinates[1];
      
      // Check that coordinates are valid numbers
      if (isNaN(parseFloat(longitude)) || isNaN(parseFloat(latitude))) {
        console.log("- Community report has invalid coordinates, returning null");
        return null;
      }
      
      const formatted = {
        id: disaster._id || disaster.id,
        title: disaster.title,
        description: disaster.description,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        category: disaster.type,
        publicationDate: disaster.createdAt,
        link: null,
        author: disaster.author,
        source: disaster.source, // Make sure source is passed through
        isUserReport: true,
        isNewsItem: false,
        displayName: disaster.location?.displayName || null
      };
      
      console.log("- Successfully formatted community report:", formatted.title);
      return formatted;
    }
    
    // If we get here, it's an invalid type combination or data
    console.log("- Invalid format combination, returning null");
    return null;
  }, []);

  // Combine and format all disaster data with better filtering for invalid data
  const allDisasters = useMemo(() => {
    console.log("allDisasters function running with:", {
      userReportsCount: userReports.length,
      newsItemsCount: newsItems.length,
      showUserReports,
      showNewsItems
    });
    
    // Filter the community reports by radius first if user has location
    let filteredCommunityReports = userReports.filter(post => {
      // Exclude news/weather service alerts from community reports
      const isNewsSource = 
        post.source === 'National Weather Service' || 
        post.source === 'USGS Earthquake Hazards Program' ||
        post.source?.includes('NWS') ||
        (post.title?.includes('issued') && post.title?.includes('NWS'));
        
      if (isNewsSource) {
        console.log("Identified news item in userReports, moving to news items:", post.title);
        return false; // Exclude this item from community reports
      }
      
      return true;
    });
    
    // Identify any news items that might be in userReports
    const newsFromUserReports = userReports.filter(post => {
      return (
        post.source === 'National Weather Service' || 
        post.source === 'USGS Earthquake Hazards Program' ||
        post.source?.includes('NWS') ||
        (post.title?.includes('issued') && post.title?.includes('NWS'))
      );
    });
    
    console.log(`Found ${newsFromUserReports.length} news items in userReports array`);
    if (newsFromUserReports.length > 0) {
      console.log("Sample news from userReports:", newsFromUserReports[0].title);
    }
    
    // Apply radius filtering to community reports
    if (userLocation && userLocation.latitude && userLocation.longitude) {
      const radiusMiles = userLocation.radiusMiles || 50;
      
      filteredCommunityReports = filteredCommunityReports.filter(post => {
        // Skip posts without valid coordinates
        if (!post.location || !post.location.coordinates || post.location.coordinates.length < 2) {
          return false;
        }
        
        const postLng = post.location.coordinates[0];
        const postLat = post.location.coordinates[1];
        
        // Earth's radius in km
        const R = 6371;
        
        // Convert coordinates to radians
        const lat1 = userLocation.latitude * Math.PI / 180;
        const lon1 = userLocation.longitude * Math.PI / 180;
        const lat2 = postLat * Math.PI / 180;
        const lon2 = postLng * Math.PI / 180;
        
        // Haversine formula
        const dLat = lat2 - lat1;
        const dLon = lon2 - lon1;
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1) * Math.cos(lat2) * 
          Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distanceKm = R * c;
        const distanceMiles = distanceKm * 0.621371;
        
        return distanceMiles <= radiusMiles;
      });
    }
    
    // Now combine filtered community reports with news reports
    // Make sure we're setting isUserReport and isNewsItem correctly
    const combinedDisasters = [
      ...(showUserReports ? filteredCommunityReports.map(report => formatDisasterData(report, true, false)).filter(Boolean) : []),
      ...(showNewsItems ? [
        ...newsItems.map(news => formatDisasterData(news, false, true)), 
        ...newsFromUserReports.map(news => formatDisasterData(news, false, true))
      ].filter(Boolean) : [])
    ];
    
    console.log("allDisasters returning combined items:", combinedDisasters.length);
    return combinedDisasters;
  }, [
    showUserReports, 
    userReports, 
    showNewsItems, 
    newsItems, 
    formatDisasterData, 
    userLocation?.radiusMiles,
    userLocation?.latitude, 
    userLocation?.longitude
  ]);

  // Get filtered posts based on current view settings
  const filteredPosts = useMemo(() => {
    console.log("FILTERED POSTS running. activeTab =", activeTab);
    console.log("- userReports:", userReports?.length, "items");
    console.log("- newsItems:", newsItems?.length, "items");
    
    if (activeTab === "community") {
      if (!showUserReports) return [];
      
      // Make a more targeted filter to exclude news items
      // Check for source fields that would indicate it's from a news/alert API
      const communityReports = userReports.filter(post => {
        // Identify news items by source or other properties
        const isNewsSource = 
          post.source === 'National Weather Service' || 
          post.source === 'USGS Earthquake Hazards Program' ||
          post.source?.includes('NWS') ||
          (post.title?.includes('issued') && post.title?.includes('NWS'));
          
        // If any news indicators are found, exclude it
        return !isNewsSource;
      });
      
      console.log("- communityReports after better filtering:", communityReports.length, "items");
      
      // Filter community reports by user's radius
      if (userLocation && userLocation.latitude && userLocation.longitude) {
        const radiusMiles = userLocation.radiusMiles || 50;
        
        const filteredByRadius = communityReports.filter(post => {
          // Skip posts without valid coordinates
          if (!post.location || !post.location.coordinates || post.location.coordinates.length < 2) {
            return false;
          }
          
          const postLng = post.location.coordinates[0];
          const postLat = post.location.coordinates[1];
          
          // Earth's radius in km
          const R = 6371;
          
          // Convert coordinates to radians
          const lat1 = userLocation.latitude * Math.PI / 180;
          const lon1 = userLocation.longitude * Math.PI / 180;
          const lat2 = postLat * Math.PI / 180;
          const lon2 = postLng * Math.PI / 180;
          
          // Haversine formula
          const dLat = lat2 - lat1;
          const dLon = lon2 - lon1;
          const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1) * Math.cos(lat2) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distanceKm = R * c;
          const distanceMiles = distanceKm * 0.621371;
          
          return distanceMiles <= radiusMiles;
        });
        
        console.log("- filteredByRadius final:", filteredByRadius.length, "items");
        return filteredByRadius;
      }
      
      return communityReports;
    } else {
      // For news tab - update to specifically include news items from both sources
      if (!showNewsItems) {
        console.log("- News items are hidden");
        return [];
      }
      
      // Get news from API and any news posts from the database
      const newsFromUserReports = userReports.filter(post => {
        // Identify news items by source or other properties
        const isNewsItem = (
          post.source === 'National Weather Service' || 
          post.source === 'USGS Earthquake Hazards Program' ||
          post.source?.includes('NWS') ||
          (post.title?.includes('issued') && post.title?.includes('NWS'))
        );
        
        if (isNewsItem) {
          console.log("IDENTIFIED NEWS ITEM IN USER REPORTS:", {
            title: post.title,
            source: post.source,
            isNWS: post.source?.includes('NWS') || post.title?.includes('NWS'),
            isUSGS: post.source?.includes('USGS') || post.title?.includes('Earthquake')
          });
        }
        
        return isNewsItem;
      });
      
      console.log("DEBUG: Found news items in userReports:", newsFromUserReports.length);
      if (newsFromUserReports.length > 0) {
        newsFromUserReports.forEach((item, index) => {
          console.log(`News item from userReports #${index + 1}:`, {
            title: item.title,
            source: item.source,
            hasCoordinates: item.location?.coordinates ? "yes" : "no",
            coordinates: item.location?.coordinates
          });
        });
      }
      
      // Filter news items by radius
      let filteredNewsItems = [...newsItems];
      let filteredNewsFromUserReports = [...newsFromUserReports];
      
      if (userLocation && userLocation.latitude && userLocation.longitude) {
        const radiusMiles = userLocation.radiusMiles || 50;
        
        // Filter API news items by radius
        filteredNewsItems = newsItems.filter(item => {
          let lat, lng;
          
          if (item.latitude && item.longitude) {
            lat = parseFloat(item.latitude);
            lng = parseFloat(item.longitude);
          } else if (item.location?.coordinates?.length === 2) {
            lng = item.location.coordinates[0];
            lat = item.location.coordinates[1];
          } else {
            return false;
          }
          
          if (isNaN(lat) || isNaN(lng)) return false;
          
          // Earth's radius in km
          const R = 6371;
          
          // Convert coordinates to radians
          const lat1 = userLocation.latitude * Math.PI / 180;
          const lon1 = userLocation.longitude * Math.PI / 180;
          const lat2 = lat * Math.PI / 180;
          const lon2 = lng * Math.PI / 180;
          
          // Haversine formula
          const dLat = lat2 - lat1;
          const dLon = lon2 - lon1;
          const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1) * Math.cos(lat2) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distanceKm = R * c;
          const distanceMiles = distanceKm * 0.621371;
          
          return distanceMiles <= radiusMiles;
        });
        
        // Filter user reports news items by radius
        filteredNewsFromUserReports = newsFromUserReports.filter(post => {
          if (!post.location || !post.location.coordinates || post.location.coordinates.length < 2) {
            console.log("NEWS FROM USER REPORTS - Missing coordinates:", post.title);
            return false;
          }
          
          const postLng = post.location.coordinates[0];
          const postLat = post.location.coordinates[1];
          
          // Earth's radius in km
          const R = 6371;
          
          // Convert coordinates to radians
          const lat1 = userLocation.latitude * Math.PI / 180;
          const lon1 = userLocation.longitude * Math.PI / 180;
          const lat2 = postLat * Math.PI / 180;
          const lon2 = postLng * Math.PI / 180;
          
          // Haversine formula
          const dLat = lat2 - lat1;
          const dLon = lon2 - lon1;
          const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1) * Math.cos(lat2) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distanceKm = R * c;
          const distanceMiles = distanceKm * 0.621371;
          
          const inRadius = distanceMiles <= radiusMiles;
          if (inRadius) {
            console.log("NEWS FROM USER REPORTS - In radius:", post.title, distanceMiles.toFixed(1), "miles");
          } else {
            console.log("NEWS FROM USER REPORTS - Outside radius:", post.title, distanceMiles.toFixed(1), "miles");
          }
          
          return inRadius;
        });
      }
      
      console.log("After filtering by radius:", {
        apiNewsCount: filteredNewsItems.length,
        userNewsCount: filteredNewsFromUserReports.length
      });
      
      const allNewsItems = [
        ...filteredNewsItems, // These come from external APIs
        ...filteredNewsFromUserReports // These are weather reports from user database
      ];
      
      console.log("- News tab selected, returning combined news items:", allNewsItems.length, "items");
      
      if (allNewsItems.length > 0) {
        allNewsItems.forEach((item, index) => {
          console.log(`News item #${index + 1}:`, {
            title: item.title,
            source: item.source,
            type: item.type,
            hasCoordinates: (item.latitude && item.longitude) || 
                           (item.location?.coordinates) ? "yes" : "no"
          });
        });
      } else {
        console.log("- No news items found after filtering");
      }
      
      return allNewsItems;
    }
  }, [
    activeTab, 
    showUserReports, 
    userReports, 
    showNewsItems, 
    newsItems, 
    userLocation?.latitude,
    userLocation?.longitude,
    userLocation?.radiusMiles
  ]);

  // Get marker icon based on disaster type
  const getMarkerIcon = useCallback((category, isUserReport = false, isNewsItem = false) => {
    // For user reports, use red-pushpin
    if (isUserReport) {
      return "https://maps.google.com/mapfiles/ms/icons/red-pushpin.png";
    }
    
    // For news items, use green-dot since it's more reliable
    return "https://maps.google.com/mapfiles/ms/icons/green-dot.png";
  }, []);

  // Handle map load
  const onMapLoad = useCallback((map) => {
    console.log("Map loaded");
    setMapRef(map);
    
    // If we have a user location, center the map and zoom correctly
    if (userLocation && userLocation.latitude && userLocation.longitude) {
      map.setCenter({
        lat: parseFloat(userLocation.latitude),
        lng: parseFloat(userLocation.longitude)
      });
      
      // Set a slightly zoomed out view to show the radius around user location
      const radiusMiles = userLocation.radiusMiles || 50;
      let zoom = 10; // default zoom
      
      // Calculate a better zoom level based on radius
      if (radiusMiles <= 5) zoom = 13;
      else if (radiusMiles <= 10) zoom = 12;
      else if (radiusMiles <= 25) zoom = 11;
      else if (radiusMiles <= 50) zoom = 10;
      else if (radiusMiles <= 100) zoom = 9;
      else zoom = 8;
      
      map.setZoom(zoom);
    }
  }, [userLocation]);

  // Safely render markers to prevent errors
  const renderSafeMarkers = useCallback(() => {
    try {
      return (
        <>
          {/* Current Location Marker */}
          {userLocation && userLocation.latitude && userLocation.longitude && (
            <>
              <Marker
                key="current-location"
                position={{
                  lat: parseFloat(userLocation.latitude),
                  lng: parseFloat(userLocation.longitude)
                }}
                icon={{
                  url: CURRENT_LOCATION_MARKER,
                  scaledSize: window.google && window.google.maps ? 
                    new window.google.maps.Size(40, 40) : null // Make it slightly larger, with safety check
                }}
                animation={window.google && window.google.maps ? 
                  window.google.maps.Animation.DROP : null}
                title="Your Location"
                zIndex={1000} // Place it above other markers
                onClick={() => setSelectedDisaster({
                  id: 'current-location',
                  title: 'Your Location',
                  description: userLocation.displayName || `${userLocation.latitude}, ${userLocation.longitude}`,
                  latitude: userLocation.latitude,
                  longitude: userLocation.longitude,
                  isCurrentLocation: true
                })}
              />
              <Circle
                center={{
                  lat: parseFloat(userLocation.latitude),
                  lng: parseFloat(userLocation.longitude)
                }}
                radius={userLocation.radiusMiles * 1609.34} // Convert miles to meters
                options={{
                  strokeColor: '#0066cc',
                  strokeOpacity: 0.8,
                  strokeWeight: 2,
                  fillColor: '#0066cc',
                  fillOpacity: 0.1,
                  zIndex: 1
                }}
              />
            </>
          )}

          {/* Regular Disaster Markers */}
          {allDisasters.map(disaster => {
            if (!disaster || !disaster.latitude || !disaster.longitude) {
              console.warn("Skipping marker due to missing coordinates", disaster);
              return null;
            }
            
            const lat = parseFloat(disaster.latitude);
            const lng = parseFloat(disaster.longitude);
            
            if (isNaN(lat) || isNaN(lng)) {
              console.warn("Skipping marker due to invalid coordinates", disaster);
              return null;
            }
            
            return (
              <Marker
                key={`${disaster.isNewsItem ? 'news' : (disaster.isUserReport ? 'report' : 'alert')}-${disaster.id}`}
                position={{ lat, lng }}
                icon={getMarkerIcon(disaster.category, disaster.isUserReport, disaster.isNewsItem)}
                onClick={() => setSelectedDisaster(disaster)}
                title={disaster.title}
              />
            );
          })}
        </>
      );
    } catch (error) {
      console.error("Error rendering markers:", error);
      return null;
    }
  }, [allDisasters, userLocation, getMarkerIcon, setSelectedDisaster]);

  // Fetch disaster data with proper memoization
  const fetchDisasterData = useCallback(async () => {
    setDataLoading(true);
    try {
      const radiusValue = userLocation?.radiusMiles || 50;
      console.log("Fetching disaster data with radius:", radiusValue);
      const token = localStorage.getItem('token');
      
      // Fetch news items with radius filter
      const newsData = await getDisasterNews(radiusValue, token);
      console.log("NEWS DATA FETCHED:", newsData.length, "items");
      if (newsData.length > 0) {
        // Log details of the first few items to help debugging
        newsData.slice(0, 3).forEach((item, i) => {
          console.log(`API News item #${i+1}:`, {
            title: item.title, 
            source: item.source,
            coordinates: [item.longitude, item.latitude],
            category: item.category
          });
        });
      }
      setNewsItems(newsData);
      
      // Fetch user-submitted reports with radius filter
      try {
        // Apply radius filter through query parameter
        let url = `http://localhost:5000/api/posts?radius=${radiusValue}`;
        
        // Add explicit lat/lng params to ensure filtering works even if backend doesn't have location
        if (userLocation && userLocation.latitude && userLocation.longitude) {
          url += `&lat=${userLocation.latitude}&lng=${userLocation.longitude}`;
        }
        
        console.log("Fetching community reports with URL:", url);
        
        const response = await fetch(url, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        
        if (!response.ok) {
          throw new Error("Failed to fetch user reports");
        }
        
        const reportsData = await response.json();
        console.log("RESPONSE DATA RECEIVED:", reportsData.length, "total items");
        
        // Filter but don't exclude any specific type - just make sure they have coordinates
        const communityReports = reportsData.filter(report => 
          report.location && 
          report.location.coordinates && 
          report.location.coordinates.length === 2
        );
        
        console.log("COMMUNITY REPORTS FILTERED:", communityReports.length, "items");
        
        // Check if we have any weather reports in the data
        const weatherReports = communityReports.filter(report => 
          report.source === 'National Weather Service' || 
          report.source === 'USGS Earthquake Hazards Program' ||
          report.source?.includes('NWS') ||
          (report.title?.includes('issued') && report.title?.includes('NWS'))
        );
        
        console.log("WEATHER REPORTS FOUND:", weatherReports.length, "items");
        if (weatherReports.length > 0) {
          weatherReports.forEach((report, i) => {
            console.log(`Weather report #${i+1} in community data:`, {
              title: report.title,
              source: report.source,
              coordinates: report.location?.coordinates,
              type: report.type
            });
          });
        }
        
        if (communityReports.length > 0) {
          console.log("Sample community report:", {
            title: communityReports[0].title,
            type: communityReports[0].type,
            source: communityReports[0].source,
            coordinates: communityReports[0].location?.coordinates
          });
        }
        
        setUserReports(communityReports);
      } catch (reportError) {
        console.error("Error fetching user reports:", reportError);
        // Still continue even if user reports fail
      }
    } catch (error) {
      console.error("Error fetching disaster data:", error);
      setError("Failed to load disaster data. Please try again later.");
    } finally {
      setDataLoading(false);
      setLoading(false);
    }
  }, [userLocation?.radiusMiles, userLocation?.latitude, userLocation?.longitude]);

  // Update state when userLocation changes
  useEffect(() => {
    console.log("Map component mounting, userLocation:", userLocation);
    
    if (userLocation) {
      console.log("Setting map center to:", userLocation);
      setLocation(userLocation);
      setCenter({
        lat: userLocation.latitude,
        lng: userLocation.longitude
      });
      
      // Fetch data with current radius
      fetchDisasterData();
    } else {
      console.warn("No user location available for map initialization");
      setLoading(false);
    }
  }, [userLocation, fetchDisasterData]);

  // Handle radius change
  const handleRadiusChange = async (e) => {
    const newRadius = parseInt(e.target.value, 10);
    console.log(`Changing map radius from ${userLocation?.radiusMiles} to ${newRadius} miles`);
    
    try {
      // Update radius in auth context
      await updateUserRadius(newRadius);
      
      // Explicitly re-fetch data to ensure we get fresh data for the new radius
      console.log("Explicitly re-fetching map data for new radius");
      await fetchDisasterData();
    } catch (error) {
      console.error("Error updating radius:", error);
      setError("Failed to update radius. Please try again.");
    }
  };

  // Handle tab changes
  const handleTabChange = (tabName) => {
    console.log(`Switching tabs from "${activeTab}" to "${tabName}"`);
    setActiveTab(tabName);
    
    // Add a check to force a re-filtering of posts
    if (tabName === "news") {
      console.log("Explicitly checking for news items after tab change");
      // Log what we would filter to help debug
      const newsFromUserReports = userReports.filter(post => 
        post.source === 'National Weather Service' || 
        post.source === 'USGS Earthquake Hazards Program' ||
        post.source?.includes('NWS') ||
        (post.title?.includes('issued') && post.title?.includes('NWS'))
      );
      
      console.log(`Tab change found ${newsFromUserReports.length} news items in userReports`);
      if (newsFromUserReports.length > 0) {
        newsFromUserReports.forEach((item, i) => {
          console.log(`News in userReports #${i+1}:`, {
            title: item.title,
            source: item.source, 
            coordinates: item.location?.coordinates
          });
        });
      }
    }
  };

  // If map loading failed, show error
  if (loadError) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Error loading map</h2>
        <p>There was an error loading the map. Please try again later.</p>
        <p>Error details: {loadError.message}</p>
      </div>
    );
  }

  // If map is not loaded yet, show loading state
  if (!isLoaded) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Loading Map</h2>
        <p>Please wait while we load the map...</p>
      </div>
    );
  }

  // Define styles for posts section
  const reportCardStyle = {
    backgroundColor: '#fff',
    padding: '15px',
    borderRadius: '5px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
    marginBottom: '15px',
    transition: 'all 0.3s',
    cursor: 'pointer',
  };

  const tabStyle = {
    display: 'flex',
    borderBottom: '1px solid #ddd',
    marginBottom: '20px',
  };

  const tabItemStyle = (isActive) => ({
    padding: '10px 20px',
    cursor: 'pointer',
    fontWeight: isActive ? 'bold' : 'normal',
    borderBottom: isActive ? '2px solid #0066cc' : 'none',
    color: isActive ? '#0066cc' : '#333',
  });

  const emptyStateStyle = {
    textAlign: 'center',
    padding: '30px',
    backgroundColor: '#f8f9fa',
    borderRadius: '5px',
    marginBottom: '20px',
  };

  return (
    <ErrorBoundary>
      <div style={{ padding: '15px' }}>
        <h1 style={{ fontSize: '24px', marginBottom: '15px' }}>Disaster Map</h1>
        
        {error && (
          <div style={{ 
            backgroundColor: '#f8d7da', 
            color: '#721c24', 
            padding: '10px', 
            borderRadius: '5px',
            marginBottom: '15px'
          }}>
            {error}
            <button 
              onClick={() => { setError(null); fetchDisasterData(); }} 
              style={{
                marginLeft: '10px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                padding: '5px 10px',
                borderRadius: '3px',
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
          </div>
        )}
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '15px',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div>
            <h2 style={{ fontSize: '18px', margin: '0 0 5px 0' }}>Disaster Alerts & Reports</h2>
            {userLocation && (
              <p style={{ margin: '0', fontSize: '14px' }}>
                Showing data within <strong>{userLocation.radiusMiles || 50} miles</strong> of your location
              </p>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {userLocation && (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <label htmlFor="radius-select" style={{ marginRight: '10px', fontSize: '14px' }}>
                  Radius:
                </label>
                <select 
                  id="radius-select"
                  value={userLocation.radiusMiles || 50}
                  onChange={handleRadiusChange}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '4px',
                    border: '1px solid #ccc'
                  }}
                >
                  <option value="5">5 miles</option>
                  <option value="10">10 miles</option>
                  <option value="25">25 miles</option>
                  <option value="50">50 miles</option>
                  <option value="100">100 miles</option>
                  <option value="200">200 miles</option>
                </select>
              </div>
            )}
            
            <button 
              onClick={() => setShowUserReports(!showUserReports)}
              style={{
                backgroundColor: showUserReports ? '#dc3545' : '#6c757d',
                color: 'white',
                border: 'none',
                padding: '5px 10px',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              {showUserReports ? 'Hide Community Reports' : 'Show Community Reports'}
            </button>
            
            <button 
              onClick={() => setShowNewsItems(!showNewsItems)}
              style={{
                backgroundColor: showNewsItems ? '#28a745' : '#6c757d',
                color: 'white',
                border: 'none',
                padding: '5px 10px',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              {showNewsItems ? 'Hide News Reports' : 'Show News Reports'}
            </button>
          </div>
        </div>
        
        {loading || dataLoading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <p>Loading map data...</p>
          </div>
        ) : (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={center}
            zoom={10}
            onLoad={onMapLoad}
            options={{
              fullscreenControl: true,
              streetViewControl: false,
              mapTypeControl: true,
              zoomControl: true,
            }}
          >
            {/* Render markers safely */}
            {renderSafeMarkers()}
            
            {/* Info window for selected disaster */}
            {selectedDisaster && (
              <InfoWindow
                position={{
                  lat: parseFloat(selectedDisaster.latitude),
                  lng: parseFloat(selectedDisaster.longitude),
                }}
                onCloseClick={() => setSelectedDisaster(null)}
              >
                <div style={{ maxWidth: '300px' }}>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '16px' }}>{selectedDisaster.title}</h3>
                  
                  {selectedDisaster.isCurrentLocation ? (
                    <div style={{
                      backgroundColor: '#e6f2ff', 
                      color: '#0066cc',
                      padding: '5px 10px',
                      borderRadius: '3px',
                      display: 'inline-block',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      marginBottom: '10px'
                    }}>
                      YOUR LOCATION
                    </div>
                  ) : selectedDisaster.category && (
                    <div style={getCategoryStyle(selectedDisaster.category)}>
                      {selectedDisaster.category.toUpperCase()}
                    </div>
                  )}
                  
                  <p style={{ margin: '10px 0', fontSize: '14px' }}>{selectedDisaster.description}</p>
                  
                  {!selectedDisaster.isCurrentLocation && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      borderTop: '1px solid #eee',
                      paddingTop: '8px',
                      marginTop: '8px',
                      fontSize: '12px'
                    }}>
                      <span>
                        {selectedDisaster.publicationDate && formatDate(selectedDisaster.publicationDate)}
                      </span>
                      <span>
                        {selectedDisaster.isUserReport ? 'Community Report' : 'News Report'}
                      </span>
                    </div>
                  )}
                  
                  {selectedDisaster.isCurrentLocation && userLocation && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      borderTop: '1px solid #eee',
                      paddingTop: '8px',
                      marginTop: '8px',
                      fontSize: '12px'
                    }}>
                      <span>
                        Radius: <strong>{userLocation.radiusMiles} miles</strong>
                      </span>
                    </div>
                  )}
                  
                  {selectedDisaster.link && (
                    <div style={{ marginTop: '10px' }}>
                      <a 
                        href={selectedDisaster.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-block',
                          backgroundColor: '#0066cc',
                          color: 'white',
                          padding: '5px 10px',
                          borderRadius: '3px',
                          textDecoration: 'none',
                          fontSize: '12px'
                        }}
                      >
                        Read Full Article
                      </a>
                    </div>
                  )}
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        )}
        
        <div style={{ marginTop: '20px' }}>
          <h3 style={{ fontSize: '16px', margin: '0 0 10px 0' }}>Map Legend</h3>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <img src={CURRENT_LOCATION_MARKER} alt="Your Location" style={{ height: '20px' }} />
              <span>Your Location</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <img src="https://maps.google.com/mapfiles/ms/icons/red-pushpin.png" alt="Community Report" style={{ height: '20px' }} />
              <span>Community Reports</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <img src="https://maps.google.com/mapfiles/ms/icons/green-dot.png" alt="News Report" style={{ height: '20px' }} />
              <span>News Reports</span>
            </div>
          </div>
        </div>

        {/* New Posts Section Below Map */}
        <div style={{ marginTop: '30px' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '15px' }}>Disaster Reports</h2>
          
          {/* Tabs Navigation */}
          <div style={tabStyle}>
            <div 
              style={tabItemStyle(activeTab === "community")}
              onClick={() => handleTabChange("community")}
            >
              Community Reports {showUserReports ? '' : '(Hidden)'}
            </div>
            <div 
              style={tabItemStyle(activeTab === "news")}
              onClick={() => handleTabChange("news")}
            >
              News Reports {showNewsItems ? '' : '(Hidden)'}
            </div>
          </div>
          
          {/* Posts List */}
          {loading || dataLoading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <p>Loading disaster reports...</p>
            </div>
          ) : (
            <div>
              {activeTab === "community" && (
                <>
                  {filteredPosts.length === 0 ? (
                    <div style={emptyStateStyle}>
                      {!showUserReports && (
                        <p>Community reports are currently hidden. Click "Show Community Reports" to view them.</p>
                      )}
                      {showUserReports && (
                        <p>No community reports found within {userLocation?.radiusMiles || 50} miles of your location.</p>
                      )}
                    </div>
                  ) : (
                    filteredPosts.map(post => {
                      console.log("Rendering community post:", post.title, "type:", post.type, "source:", post.source);
                      
                      // Additional check to make sure this isn't a news item
                      if (post.source === 'National Weather Service' || 
                          post.source === 'USGS Earthquake Hazards Program' ||
                          post.source?.includes('NWS') ||
                          (post.title?.includes('issued') && post.title?.includes('NWS'))) {
                        console.warn("Excluded news item from community tab:", post.title);
                        return null;
                      }
                      
                      // Format post data for display
                      const formattedPost = formatDisasterData(post, true, false);
                      
                      if (!formattedPost) {
                        console.log("- Post format returned null:", post.title);
                        return null;
                      }
                      
                      // Calculate distance for community reports
                      let distance = null;
                      if (activeTab === "community" && userLocation && post.location?.coordinates) {
                        const postLng = post.location.coordinates[0];
                        const postLat = post.location.coordinates[1];
                        
                        // Earth's radius in km
                        const R = 6371;
                        
                        // Convert coordinates to radians
                        const lat1 = userLocation.latitude * Math.PI / 180;
                        const lon1 = userLocation.longitude * Math.PI / 180;
                        const lat2 = postLat * Math.PI / 180;
                        const lon2 = postLng * Math.PI / 180;
                        
                        // Haversine formula
                        const dLat = lat2 - lat1;
                        const dLon = lon2 - lon1;
                        const a = 
                          Math.sin(dLat/2) * Math.sin(dLat/2) +
                          Math.cos(lat1) * Math.cos(lat2) * 
                          Math.sin(dLon/2) * Math.sin(dLon/2);
                        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                        const distanceKm = R * c;
                        distance = (distanceKm * 0.621371).toFixed(1); // Convert to miles and round to 1 decimal
                      }
                      
                      return (
                        <div key={formattedPost.id} style={reportCardStyle} onClick={() => setSelectedDisaster(formattedPost)}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              {formattedPost.category && (
                                <div style={getCategoryStyle(formattedPost.category)}>
                                  {formattedPost.category.toUpperCase()}
                                </div>
                              )}
                              <h3 style={{ margin: '5px 0 10px', fontSize: '18px' }}>{formattedPost.title}</h3>
                            </div>
                            <div style={{ color: '#666', fontSize: '0.8rem' }}>
                              {formattedPost.publicationDate && formatDate(formattedPost.publicationDate)}
                            </div>
                          </div>
                          
                          <p style={{ margin: '10px 0' }}>{formattedPost.description}</p>
                          
                          <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '5px' }}>
                            {formattedPost.displayName && (
                              <p style={{ margin: '0 0 5px 0' }}>
                                <strong>Location:</strong> {formattedPost.displayName}
                                {distance && ` (${distance} miles away)`}
                              </p>
                            )}
                            {!formattedPost.displayName && distance && (
                              <p style={{ margin: '0 0 5px 0' }}>
                                <strong>Distance:</strong> {distance} miles away
                              </p>
                            )}
                          </div>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px', fontSize: '0.9rem' }}>
                            {formattedPost.isNewsItem && formattedPost.link && (
                              <a 
                                href={formattedPost.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  display: 'inline-block',
                                  backgroundColor: '#0066cc',
                                  color: 'white',
                                  padding: '5px 10px',
                                  borderRadius: '3px',
                                  textDecoration: 'none',
                                  fontSize: '12px'
                                }}
                              >
                                Read Full Article
                              </a>
                            )}
                            <div style={{ marginLeft: 'auto' }}>
                              By: {formattedPost.author || 'Anonymous'}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </>
              )}
              {activeTab === "news" && (
                <div>
                  {filteredPosts.length === 0 ? (
                    <div style={emptyStateStyle}>
                      {!showNewsItems && (
                        <p>News reports are currently hidden. Click "Show News Reports" to view them.</p>
                      )}
                      {showNewsItems && (
                        <div>
                          <p>No news reports found within {userLocation?.radiusMiles || 50} miles of your location.</p>
                          <p>Debug info: {newsItems?.length || 0} API news items, {userReports?.filter(post => 
                            post.source === 'National Weather Service' || 
                            post.source === 'USGS Earthquake Hazards Program' ||
                            post.source?.includes('NWS') ||
                            (post.title?.includes('issued') && post.title?.includes('NWS'))
                          ).length} user report news items</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    filteredPosts.map(post => {
                      console.log("Rendering news post:", post.title, "source:", post.source);
                      
                      // Try to identify NWS vs Earthquake reports
                      const isNWS = post.source === 'National Weather Service' || 
                                  post.source?.includes('NWS') || 
                                  (post.title?.includes('issued') && post.title?.includes('NWS'));
                      const isEarthquake = post.source === 'USGS Earthquake Hazards Program' || 
                                          post.source?.includes('USGS') || 
                                          post.title?.includes('Earthquake');
                      
                      console.log(`Post classification: isNWS=${isNWS}, isEarthquake=${isEarthquake}`);
                      
                      // Format post data for display - important: set isNewsItem to true for proper formatting
                      const formattedPost = formatDisasterData(post, false, true);
                      
                      if (!formattedPost) {
                        console.log("- News post format returned null:", post.title);
                        return null;
                      }
                      
                      console.log("- News post passing all filters:", formattedPost.title, {
                        latitude: formattedPost.latitude,
                        longitude: formattedPost.longitude,
                        hasLatLng: formattedPost.latitude && formattedPost.longitude ? "yes" : "no"
                      });
                      
                      // Calculate distance for news reports if we have coordinates
                      let distance = null;
                      if (userLocation && userLocation.latitude && userLocation.longitude && 
                          formattedPost.latitude && formattedPost.longitude) {
                        // Earth's radius in km
                        const R = 6371;
                        
                        // Convert coordinates to radians
                        const lat1 = userLocation.latitude * Math.PI / 180;
                        const lon1 = userLocation.longitude * Math.PI / 180;
                        const lat2 = formattedPost.latitude * Math.PI / 180;
                        const lon2 = formattedPost.longitude * Math.PI / 180;
                        
                        // Haversine formula
                        const dLat = lat2 - lat1;
                        const dLon = lon2 - lon1;
                        const a = 
                          Math.sin(dLat/2) * Math.sin(dLat/2) +
                          Math.cos(lat1) * Math.cos(lat2) * 
                          Math.sin(dLon/2) * Math.sin(dLon/2);
                        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                        const distanceKm = R * c;
                        distance = (distanceKm * 0.621371).toFixed(1); // Convert to miles and round to 1 decimal
                        console.log(`Calculated distance for ${formattedPost.title}: ${distance} miles`);
                      }
                      
                      return (
                        <div key={formattedPost.id || `news-${Math.random()}`} style={reportCardStyle} onClick={() => setSelectedDisaster(formattedPost)}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              {formattedPost.category && (
                                <div style={getCategoryStyle(formattedPost.category)}>
                                  {formattedPost.category.toUpperCase()}
                                </div>
                              )}
                              <h3 style={{ margin: '5px 0 10px', fontSize: '18px' }}>{formattedPost.title}</h3>
                            </div>
                            <div style={{ color: '#666', fontSize: '0.8rem' }}>
                              {formattedPost.publicationDate && formatDate(formattedPost.publicationDate)}
                            </div>
                          </div>
                          
                          <p style={{ margin: '10px 0' }}>{formattedPost.description}</p>
                          
                          <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '5px' }}>
                            {formattedPost.displayName && (
                              <p style={{ margin: '0 0 5px 0' }}>
                                <strong>Location:</strong> {formattedPost.displayName}
                              </p>
                            )}
                            {distance && (
                              <p style={{ margin: '0 0 5px 0' }}>
                                <strong>Distance:</strong> {distance} miles away
                              </p>
                            )}
                            {!formattedPost.displayName && !distance && formattedPost.latitude && formattedPost.longitude && (
                              <p style={{ margin: '0 0 5px 0' }}>
                                <strong>Coordinates:</strong> {formattedPost.latitude.toFixed(4)}, {formattedPost.longitude.toFixed(4)}
                              </p>
                            )}
                          </div>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px', fontSize: '0.9rem' }}>
                            {formattedPost.link && (
                              <a 
                                href={formattedPost.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  display: 'inline-block',
                                  backgroundColor: '#0066cc',
                                  color: 'white',
                                  padding: '5px 10px',
                                  borderRadius: '3px',
                                  textDecoration: 'none',
                                  fontSize: '12px'
                                }}
                              >
                                Read Full Article
                              </a>
                            )}
                            <div style={{ marginLeft: 'auto' }}>
                              By: {formattedPost.author || 'Anonymous'}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
});

// Format date helper
const formatDate = (dateString) => {
  const date = new Date(dateString);
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
};

// Get category style for info window
const getCategoryStyle = (category) => {
  const baseStyle = {
    display: 'inline-block',
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '12px',
    color: 'white',
    fontWeight: 'bold',
    marginBottom: '5px'
  };
  
  switch (category?.toLowerCase()) {
    case 'earthquake':
      return { ...baseStyle, backgroundColor: '#dc3545' };
    case 'flood':
      return { ...baseStyle, backgroundColor: '#17a2b8' };
    case 'hurricane':
    case 'cyclone':
    case 'typhoon':
      return { ...baseStyle, backgroundColor: '#6f42c1' };
    case 'wildfire':
      return { ...baseStyle, backgroundColor: '#fd7e14' };
    case 'tornado':
      return { ...baseStyle, backgroundColor: '#20c997' };
    default:
      return { ...baseStyle, backgroundColor: '#6c757d' };
  }
};

export default Map;