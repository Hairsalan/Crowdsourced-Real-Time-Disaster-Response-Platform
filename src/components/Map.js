function Map() {
    return (
      <div>
        <h1>Disaster Map</h1>
        <div
          style={{
            border: "1px solid black",
            height: "400px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          Map Placeholder
        </div>
        <div>
          <h2>Legend</h2>
          <ul>
            <li>🔴 Fire</li>
            <li>🔵 Flood</li>
            <li>🟡 Earthquake</li>
            <li>⚪ Other</li>
          </ul>
        </div>
      </div>
    )
  }
  
  export default Map
  
  