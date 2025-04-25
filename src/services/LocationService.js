// LocationService.js - Handles geolocation and location management

// Get current location using browser's Geolocation API
export const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      // Success callback
      position => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
          radiusMiles: 50 // Default radius
        };
        
        // Store the location in localStorage
        localStorage.setItem('userLocation', JSON.stringify(location));
        
        resolve(location);
      },
      // Error callback
      error => {
        let errorMessage;
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'The request to get location timed out';
            break;
          default:
            errorMessage = 'An unknown error occurred';
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
  return storedLocation ? JSON.parse(storedLocation) : null;
};

// Store manually entered location
export const storeManualLocation = async (location) => {
  try {
    // If input is a city name or address, geocode it
    if (typeof location === 'string') {
      const geocodedLocation = await geocodeAddress(location);
      
      // Add radius information
      const storedLocation = getStoredLocation();
      const radiusMiles = storedLocation && storedLocation.radiusMiles ? 
        storedLocation.radiusMiles : 50;
      
      const locationWithRadius = {
        ...geocodedLocation,
        radiusMiles
      };
      
      localStorage.setItem('userLocation', JSON.stringify(locationWithRadius));
      return locationWithRadius;
    }
    
    // If input is already coordinates, store directly
    localStorage.setItem('userLocation', JSON.stringify(location));
    return location;
  } catch (error) {
    throw new Error(`Failed to store location: ${error.message}`);
  }
};

// Update location radius
export const updateLocationRadius = (radiusMiles) => {
  const storedLocation = getStoredLocation();
  if (!storedLocation) {
    throw new Error('No location found to update radius');
  }
  
  const updatedLocation = {
    ...storedLocation,
    radiusMiles
  };
  
  localStorage.setItem('userLocation', JSON.stringify(updatedLocation));
  return updatedLocation;
};

// Geocode address/city to coordinates using OpenStreetMap Nominatim API
export const geocodeAddress = async (address) => {
  try {
    const encodedAddress = encodeURIComponent(address);
    const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1`);
    
    if (!response.ok) {
      throw new Error('Geocoding service unavailable');
    }
    
    const data = await response.json();
    
    if (!data || data.length === 0) {
      throw new Error('Location not found');
    }
    
    return {
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon),
      displayName: data[0].display_name,
      timestamp: Date.now()
    };
  } catch (error) {
    throw new Error(`Geocoding failed: ${error.message}`);
  }
};

// Reverse geocode coordinates to address
export const reverseGeocode = async (latitude, longitude) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
    );
    
    if (!response.ok) {
      throw new Error('Reverse geocoding service unavailable');
    }
    
    const data = await response.json();
    
    if (!data || !data.display_name) {
      throw new Error('Address not found');
    }
    
    return {
      displayName: data.display_name,
      city: data.address.city || data.address.town || data.address.village || data.address.county,
      state: data.address.state,
      country: data.address.country,
      postcode: data.address.postcode
    };
  } catch (error) {
    throw new Error(`Reverse geocoding failed: ${error.message}`);
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
  
  console.log(`Distance from [${lat1}, ${lon1}] to [${lat2}, ${lon2}] = ${distanceMiles.toFixed(2)} miles`);
  
  return distanceMiles;
};