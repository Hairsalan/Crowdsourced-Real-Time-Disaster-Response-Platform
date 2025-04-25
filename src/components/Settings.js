import { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";

function Settings() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [notifications, setNotifications] = useState(false);
  const [radius, setRadius] = useState(50);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const { user, updateUserLocation } = useAuth();

  useEffect(() => {
    // Load user data if available
    if (user) {
      setUsername(user.username || "");
      setNotifications(user.notifications || false);
      setRadius(user.radiusMiles || 50);
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess("");
    setError("");

    try {
      // Get token for authentication
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error("You must be logged in to update settings");
      }

      // Update user settings on the server
      const response = await fetch('http://localhost:5000/api/users/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: username,
          password: password.length > 0 ? password : undefined,
          notifications,
          radiusMiles: radius
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to update settings");
      }

      // Update radius in location context if needed
      if (user && user.radiusMiles !== radius) {
        const location = JSON.parse(localStorage.getItem('userLocation') || '{}');
        if (location) {
          location.radiusMiles = radius;
          localStorage.setItem('userLocation', JSON.stringify(location));
          updateUserLocation(location);
        }
      }

      setSuccess("Settings updated successfully");
      setPassword(""); // Clear password field after successful update
    } catch (err) {
      setError(err.message || "An error occurred");
    }
  };

  return (
    <div style={containerStyle}>
      <h1 style={headingStyle}>Profile Settings</h1>
      
      {success && (
        <div style={successStyle}>
          <p>{success}</p>
        </div>
      )}
      
      {error && (
        <div style={errorStyle}>
          <p>{error}</p>
        </div>
      )}
      
      <form onSubmit={handleSubmit} style={formStyle}>
        <div style={formGroupStyle}>
          <label htmlFor="username" style={labelStyle}>
            Username
          </label>
          <input
            type="text"
            id="username"
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={inputStyle}
            placeholder="Enter your username"
          />
        </div>
        
        <div style={formGroupStyle}>
          <label htmlFor="password" style={labelStyle}>
            New Password
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            placeholder="Leave blank to keep current password"
          />
          <p style={helperTextStyle}>
            Enter a new password only if you want to change it
          </p>
        </div>
        
        <div style={formGroupStyle}>
          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={notifications}
              onChange={(e) => setNotifications(e.target.checked)}
              style={checkboxStyle}
            />
            <span>Enable Push Notifications</span>
          </label>
          <p style={helperTextStyle}>
            Receive alerts about disasters in your area
          </p>
        </div>
        
        <div style={formGroupStyle}>
          <label htmlFor="radius" style={labelStyle}>
            Alert Radius (miles)
          </label>
          <div style={rangeContainerStyle}>
            <input
              type="range"
              id="radius"
              name="radius"
              min="1"
              max="200"
              value={radius}
              onChange={(e) => setRadius(parseInt(e.target.value, 10))}
              style={rangeStyle}
            />
            <span style={valueStyle}>{radius}</span>
          </div>
          <p style={helperTextStyle}>
            You will receive alerts for disasters within {radius} miles of your location
          </p>
        </div>
        
        <button type="submit" style={buttonStyle}>
          Save Settings
        </button>
      </form>
    </div>
  );
}

// Styles
const containerStyle = {
  maxWidth: '600px',
  margin: '0 auto',
  padding: '20px',
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
};

const headingStyle = {
  color: '#333',
  marginBottom: '24px',
  paddingBottom: '12px',
  borderBottom: '2px solid #007bff',
};

const formStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
};

const formGroupStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const labelStyle = {
  fontWeight: 'bold',
  fontSize: '16px',
  color: '#333',
};

const inputStyle = {
  padding: '12px',
  borderRadius: '4px',
  border: '1px solid #ccc',
  fontSize: '16px',
  transition: 'border-color 0.3s',
  ':focus': {
    borderColor: '#007bff',
    outline: 'none',
  }
};

const checkboxLabelStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontSize: '16px',
  color: '#333',
};

const checkboxStyle = {
  width: '18px',
  height: '18px',
  cursor: 'pointer',
};

const rangeContainerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '15px',
};

const rangeStyle = {
  flexGrow: 1,
  height: '10px',
  borderRadius: '5px',
};

const valueStyle = {
  minWidth: '40px',
  textAlign: 'center',
  fontWeight: 'bold',
  fontSize: '16px',
  color: '#007bff',
};

const helperTextStyle = {
  fontSize: '14px',
  color: '#666',
  margin: '4px 0 0 0',
};

const buttonStyle = {
  padding: '12px 20px',
  backgroundColor: '#007bff',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  fontSize: '16px',
  fontWeight: 'bold',
  cursor: 'pointer',
  transition: 'background-color 0.3s',
  marginTop: '10px',
  ':hover': {
    backgroundColor: '#0056b3',
  }
};

const successStyle = {
  backgroundColor: '#d4edda',
  color: '#155724',
  padding: '12px 16px',
  borderRadius: '4px',
  marginBottom: '20px',
};

const errorStyle = {
  backgroundColor: '#f8d7da',
  color: '#721c24',
  padding: '12px 16px',
  borderRadius: '4px',
  marginBottom: '20px',
};

export default Settings;
  
  