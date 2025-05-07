// LocationService.js - Handles geolocation and location management

// Constant for Google Maps API key (should match the one used for map display)
const GOOGLE_MAPS_API_KEY = 'AIzaSyBAiCDlrLRdS1WsK8Utj9kVLFbjiun7PkU'; // Same key from Map component

// Debug logger that shows exactly what's happening
const debugLog = (message, data = null) => {
  const timestamp = new Date().toISOString().substr(11, 12);
  console.log(`[${timestamp}] 🔍 GEO: ${message}`);
  if (data) {
    console.log(`[${timestamp}] 📋 DATA:`, data);
  }
};

// Get current location using browser's Geolocation API
export const getCurrentLocation = () => {
  debugLog('Getting current location from browser...');
  
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      debugLog('❌ Geolocation API not supported');
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      // Success callback
      position => {
        debugLog('✅ Browser geolocation succeeded', {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
          radiusMiles: 50 // Default radius
        };
        
        // Store the location in localStorage
        localStorage.setItem('userLocation', JSON.stringify(location));
        debugLog('📝 Saved location to localStorage');
        
        resolve(location);
      },
      // Error callback
      error => {
        let errorMessage;
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied';
            debugLog('❌ User denied geolocation permission');
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable';
            debugLog('❌ Position unavailable');
            break;
          case error.TIMEOUT:
            errorMessage = 'The request to get location timed out';
            debugLog('❌ Geolocation request timed out');
            break;
          default:
            errorMessage = 'An unknown error occurred';
            debugLog('❌ Unknown geolocation error', error);
        }
        reject(new Error(errorMessage));
      },
      // Options
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 600000 // 10 minutes
      }
    );
  });
};

// Get stored location or return null if not available
export const getStoredLocation = () => {
  const storedLocation = localStorage.getItem('userLocation');
  
  if (storedLocation) {
    try {
      const parsed = JSON.parse(storedLocation);
      debugLog('📤 Retrieved location from localStorage', parsed);
      return parsed;
    } catch (e) {
      debugLog('❌ Failed to parse stored location', e);
      return null;
    }
  } else {
    debugLog('⚠️ No location in localStorage');
    return null;
  }
};

// Store manually entered location
export const storeManualLocation = async (location) => {
  debugLog('Storing manual location', location);
  
  try {
    // If input is a city name or address, geocode it
    if (typeof location === 'string') {
      debugLog('🔍 Geocoding address string:', location);
      const geocodedLocation = await geocodeAddress(location);
      debugLog('✅ Geocoding successful', geocodedLocation);
      
      // Add radius information
      const storedLocation = getStoredLocation();
      const radiusMiles = storedLocation && storedLocation.radiusMiles ? 
        storedLocation.radiusMiles : 50;
      
      const locationWithRadius = {
        ...geocodedLocation,
        radiusMiles
      };
      
      debugLog('📝 Saving geocoded location to localStorage', locationWithRadius);
      localStorage.setItem('userLocation', JSON.stringify(locationWithRadius));
      return locationWithRadius;
    }
    
    // If input is already coordinates, store directly
    debugLog('📝 Saving coordinates directly to localStorage', location);
    localStorage.setItem('userLocation', JSON.stringify(location));
    return location;
  } catch (error) {
    debugLog('❌ Failed to store location', error);
    throw new Error(`Failed to store location: ${error.message}`);
  }
};

// Update location radius
export const updateLocationRadius = (radiusMiles) => {
  debugLog('Updating location radius to', radiusMiles);
  
  const storedLocation = getStoredLocation();
  if (!storedLocation) {
    debugLog('❌ No location found to update radius');
    throw new Error('No location found to update radius');
  }
  
  const updatedLocation = {
    ...storedLocation,
    radiusMiles
  };
  
  debugLog('📝 Saving updated radius to localStorage', updatedLocation);
  localStorage.setItem('userLocation', JSON.stringify(updatedLocation));
  return updatedLocation;
};

// Use Google Maps Geocoding API to convert address to coordinates
export const geocodeAddress = async (address) => {
  debugLog('🌎 GEOCODE: Starting geocode operation for address:', address);
  
  try {
    debugLog('🔍 Using Google Maps Geocoding API');
    const encodedAddress = encodeURIComponent(address);
    
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}`;
    debugLog('🔗 Fetching from URL:', url);
    
    const response = await fetch(url);
    debugLog(`🔄 Google Maps response status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      debugLog('📦 Google Maps response data:', data);
      
      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const result = data.results[0];
        debugLog('✅ Google Maps geocode success!', result);
        
        const location = {
          latitude: result.geometry.location.lat,
          longitude: result.geometry.location.lng,
          displayName: result.formatted_address,
          timestamp: Date.now()
        };
        
        debugLog('📍 Parsed location:', location);
        return location;
      } else {
        debugLog('❌ Google Maps geocoding failed with status:', data.status);
        throw new Error(`Geocoding failed: ${data.status}${data.error_message ? ' - ' + data.error_message : ''}`);
      }
    } else {
      debugLog('❌ Google Maps fetch failed with status:', response.status);
      throw new Error(`Google Maps API request failed with status: ${response.status}`);
    }
  } catch (error) {
    debugLog('❌ Google Maps geocoding exception:', error);
    throw new Error(`Could not find coordinates for "${address}". ${error.message || 'Please try a different location or be more specific.'}`);
  }
};

// Use Google Maps Geocoding API for reverse geocoding
export const reverseGeocode = async (latitude, longitude) => {
  debugLog('🌎 REVERSE GEOCODE: Starting reverse geocode for:', { latitude, longitude });
  
  try {
    debugLog('🔍 Using Google Maps Reverse Geocoding API');
    
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`;
    debugLog('🔗 Fetching from URL:', url);
    
    const response = await fetch(url);
    debugLog(`🔄 Google Maps response status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      debugLog('📦 Google Maps response data:', data);
      
      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const result = data.results[0];
        debugLog('✅ Google Maps reverse geocode success!', result);
        
        // Extract address components
        const components = {};
        result.address_components.forEach(component => {
          const type = component.types[0];
          components[type] = component.long_name;
        });
        
        // Extract city, state, country
        const street = components.route || '';
        const streetNumber = components.street_number || '';
        const addressLine = streetNumber && street ? `${streetNumber} ${street}` : street;
        const city = components.locality || components.administrative_area_level_2 || '';
        const state = components.administrative_area_level_1 || '';
        const country = components.country || '';
        const postcode = components.postal_code || '';
        
        debugLog('📦 Extracted address components:', {
          street, streetNumber, city, state, country, postcode
        });
        
        const location = {
          displayName: result.formatted_address,
          city,
          state,
          country,
          postcode
        };
        
        debugLog('📍 Final reverse geocoded location:', location);
        return location;
      } else {
        debugLog('❌ Google Maps reverse geocoding failed with status:', data.status);
        throw new Error(`Reverse geocoding failed: ${data.status}${data.error_message ? ' - ' + data.error_message : ''}`);
      }
    } else {
      debugLog('❌ Google Maps fetch failed with status:', response.status);
      throw new Error(`Google Maps API request failed with status: ${response.status}`);
    }
  } catch (error) {
    debugLog('❌ Google Maps reverse geocoding exception:', error);
    
    // Return coordinates as fallback
    return {
      displayName: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
      city: '',
      state: '',
      country: '',
      postcode: ''
    };
  }
};

// Helper function to give a more user-friendly description of coordinates
const getLocationDescription = (latitude, longitude) => {
  try {
    // Define regions based on lat/long (very rough approximation)
    let region = '';
    
    // North America regions
    if (latitude > 24 && latitude < 50 && longitude < -50 && longitude > -130) {
      if (longitude < -115) return "West Coast, USA";
      if (longitude < -90) return "Central USA";
      if (longitude < -75) return "East Coast, USA";
      return "North America";
    }
    
    // Europe
    if (latitude > 35 && latitude < 65 && longitude > -10 && longitude < 40) {
      return "Europe";
    }
    
    // Asia
    if (latitude > 10 && latitude < 60 && longitude > 60 && longitude < 150) {
      return "Asia";
    }
    
    // Australia
    if (latitude < -10 && latitude > -45 && longitude > 110 && longitude < 160) {
      return "Australia";
    }
    
    // Africa
    if (latitude > -35 && latitude < 35 && longitude > -20 && longitude < 50) {
      return "Africa";
    }
    
    // South America
    if (latitude < 15 && latitude > -60 && longitude < -30 && longitude > -90) {
      return "South America";
    }
    
    // If no specific region matches
    return `${Math.abs(latitude).toFixed(1)}° ${latitude >= 0 ? 'N' : 'S'}, ${Math.abs(longitude).toFixed(1)}° ${longitude >= 0 ? 'E' : 'W'}`;
  } catch (e) {
    return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  }
};

// Calculate distance between two points (Haversine formula)
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  // Ensure all parameters are valid numbers
  lat1 = parseFloat(lat1);
  lon1 = parseFloat(lon1);
  lat2 = parseFloat(lat2);
  lon2 = parseFloat(lon2);
  
  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
    console.error('Invalid coordinates for distance calculation', { lat1, lon1, lat2, lon2 });
    return Infinity; // Return a large value so this item gets filtered out
  }
  
  // Earth's radius in kilometers
  const R = 6371;
  
  // Convert latitude and longitude from degrees to radians
  const lat1Rad = lat1 * Math.PI / 180;
  const lon1Rad = lon1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  const lon2Rad = lon2 * Math.PI / 180;
  
  // Differences in coordinates
  const dLat = lat2Rad - lat1Rad;
  const dLon = lon2Rad - lon1Rad;
  
  // Haversine formula
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distanceKm = R * c; // Distance in km
  
  // Convert km to miles
  const distanceMiles = distanceKm * 0.621371;
  
  debugLog(`Distance calculation: [${lat1}, ${lon1}] to [${lat2}, ${lon2}] = ${distanceMiles.toFixed(2)} miles`);
  
  return distanceMiles;
};

// Handle location updates with additional context for debugging
export const updateUserLocationWithDetails = (location) => {
  try {
    // Add timestamp if not present
    if (!location.timestamp) {
      location.timestamp = new Date().toISOString();
    }
    
    // Store the updated location
    localStorage.setItem('userLocation', JSON.stringify(location));
    console.log('Location updated successfully:', location);
    return location;
  } catch (error) {
    console.error('Error updating location:', error);
    throw error;
  }
};