import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, hasLocation } = useAuth();
  const location = useLocation();
  
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
  
  // Check if user has location set - if not, redirect to settings page with location tab
  // Only exempt the settings page itself from this check
  if (!hasLocation && !location.pathname.includes('/settings')) {
    return <Navigate to="/settings" state={{ locationTabRequired: true }} replace />;
  }
  
  // If authenticated and has location (or is going to settings), render the protected content
  return children;
}

export default ProtectedRoute;