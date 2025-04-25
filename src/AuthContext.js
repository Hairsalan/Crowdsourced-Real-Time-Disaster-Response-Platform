import React, { createContext, useState, useEffect, useContext } from 'react';
import { getStoredLocation, updateLocationRadius } from './services/LocationService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [token, setToken] = useState(null);

  useEffect(() => {
    // Check if user is logged in on mount
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    
    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
      setToken(storedToken);
      
      // Fetch user data from server to get the latest location
      const fetchUserData = async () => {
        try {
          const response = await fetch('http://localhost:5000/api/users/me', {
            headers: {
              'Authorization': `Bearer ${storedToken}`
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            
            // Update user data in localStorage
            localStorage.setItem('user', JSON.stringify(userData));
            setUser(userData);
            
            // Update location if available
            if (userData.location) {
              const loc = {
                latitude: userData.location.latitude,
                longitude: userData.location.longitude,
                displayName: userData.location.displayName || `${userData.location.latitude}, ${userData.location.longitude}`,
                radiusMiles: userData.radiusMiles || 50
              };
              localStorage.setItem('userLocation', JSON.stringify(loc));
              setUserLocation(loc);
            } else {
              // Check for stored location as fallback
              const location = getStoredLocation();
              if (location) {
                setUserLocation(location);
              }
            }
          } else {
            // If API call fails, fall back to localStorage
            const location = getStoredLocation();
            if (location) {
              setUserLocation(location);
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          // Fall back to local storage if fetch fails
          const location = getStoredLocation();
          if (location) {
            setUserLocation(location);
          }
        }
      };
      
      fetchUserData();
    } else {
      // Check for stored location even if not logged in
      const location = getStoredLocation();
      if (location) {
        setUserLocation(location);
      }
    }
    
    setLoading(false);
  }, []);

  const login = async (userData, jwt) => {
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', jwt);
    localStorage.removeItem('userLocation'); // Drop any stale location
    setToken(jwt);
    
    try {
      // Immediately fetch the canonical user record with saved location
      const response = await fetch('http://localhost:5000/api/users/me', {
        headers: {
          'Authorization': `Bearer ${jwt}`
        }
      });
      
      if (response.ok) {
        const freshUser = await response.json();
        
        // Update user data in localStorage and context
        localStorage.setItem('user', JSON.stringify(freshUser));
        setUser(freshUser);
        
        // Update location if available
        if (freshUser.location) {
          const loc = {
            latitude: freshUser.location.latitude,
            longitude: freshUser.location.longitude,
            displayName: freshUser.location.displayName || `${freshUser.location.latitude}, ${freshUser.location.longitude}`,
            radiusMiles: freshUser.radiusMiles || 50
          };
          localStorage.setItem('userLocation', JSON.stringify(loc));
          setUserLocation(loc);
        }
      } else {
        // If fetch fails, use the initial userData
        setUser(userData);
      }
    } catch (error) {
      console.error("Error fetching user data during login:", error);
      // Fall back to using initial userData
      setUser(userData);
    }
  };

  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('userLocation'); // Clear saved coordinates
    setUser(null);
    setUserLocation(null); // Clear context state
    setToken(null);
  };
  
  const updateUserLocation = (location) => {
    setUserLocation(location);
  };

  // New helper method to update location on the backend
  const updateMyLocation = async (latitude, longitude, radiusMiles = 50) => {
    if (!token) throw new Error("Authentication required");
    
    try {
      console.log("🔑 token in context:", token);
      
      const response = await fetch('http://localhost:5000/api/users/me/location', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          latitude,
          longitude,
          radiusMiles
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update location on server');
      }
      
      // Update location in localStorage and context
      const loc = {
        latitude,
        longitude,
        displayName: `${latitude}, ${longitude}`,
        radiusMiles,
        timestamp: new Date().toISOString()
      };
      
      localStorage.setItem('userLocation', JSON.stringify(loc));
      setUserLocation(loc);
      
      return await response.json();
    } catch (error) {
      console.error("Error updating location:", error);
      throw error;
    }
  };

  // New method to update the radius across all components
  const updateUserRadius = async (radiusMiles) => {
    try {
      console.log("Updating user radius to:", radiusMiles);
      
      // Update in localStorage first
      const updatedLocation = updateLocationRadius(radiusMiles);
      
      // Don't update userLocation in context yet - wait for server update
      // Remove: setUserLocation(updatedLocation);

      // Update on backend if user is logged in
      if (token && updatedLocation) {
        console.log("Sending location update to server with radius:", radiusMiles);
        
        await updateMyLocation(
          updatedLocation.latitude,
          updatedLocation.longitude,
          radiusMiles
        );
      }
      
      // Now that server update is complete, update context state
      setUserLocation(updatedLocation);
      
      return updatedLocation;
    } catch (error) {
      console.error("Error updating radius:", error);
      throw error;
    }
  };

  const value = {
    user,
    token,
    isAuthenticated: !!user,
    loading,
    login,
    logout,
    userLocation,
    updateUserLocation,
    updateUserRadius,
    updateMyLocation,
    hasLocation: !!userLocation && 
      !(userLocation.latitude === 0 && userLocation.longitude === 0),
    refreshToken: async () => {
      try {
        // This is a simple implementation - in production you would want a proper token refresh mechanism
        const storedUser = localStorage.getItem('user');
        const storedToken = localStorage.getItem('token');
        
        if (!storedToken || !storedUser) {
          logout();
          return false;
        }
        
        // Attempt to validate the token
        const response = await fetch('http://localhost:5000/api/users/me', {
          headers: {
            'Authorization': `Bearer ${storedToken}`
          }
        });
        
        if (!response.ok) {
          logout();
          return false;
        }
        
        return true;
      } catch (error) {
        console.error("Error refreshing token:", error);
        logout();
        return false;
      }
    }
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};