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
            timestamp: position.timestamp
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
        localStorage.setItem('userLocation', JSON.stringify(geocodedLocation));
        return geocodedLocation;
      }
      
      // If input is already coordinates, store directly
      localStorage.setItem('userLocation', JSON.stringify(location));
      return location;
    } catch (error) {
      throw new Error(`Failed to store location: ${error.message}`);
    }
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
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Distance in km
    
    return distance;
  };