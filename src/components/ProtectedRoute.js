import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, hasLocation } = useAuth();
  const { pathname } = useLocation();
  
  // If still loading auth state, show loading indicator
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px',
        color: '#666'
      }}>
        Loading...
      </div>
    );
  }
  
  // If not authenticated, redirect to login page
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  // If authenticated but no location set, redirect to location settings
  // But only if we're not already on the settings page
  if (!hasLocation && pathname !== '/settings') {
    return <Navigate to="/settings" replace />;
  }
  
  // If authenticated and location is set, render the protected content
  return children;
}

export default ProtectedRoute;