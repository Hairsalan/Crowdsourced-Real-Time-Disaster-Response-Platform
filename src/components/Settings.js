function Settings() {
    return (
      <div>
        <h1>Settings</h1>
        <form>
          <div>
            <label htmlFor="username">Username:</label>
            <input type="text" id="username" name="username" />
          </div>
          <div>
            <label htmlFor="password">New Password:</label>
            <input type="password" id="password" name="password" />
          </div>
          <div>
            <label htmlFor="notifications">Push Notifications:</label>
            <input type="checkbox" id="notifications" name="notifications" />
          </div>
          <div>
            <label htmlFor="radius">Alert Radius (miles):</label>
            <input type="number" id="radius" name="radius" min="1" max="100" />
          </div>
          <button type="submit">Save Settings</button>
        </form>
      </div>
    )
  }
  
  export default Settings
  
  