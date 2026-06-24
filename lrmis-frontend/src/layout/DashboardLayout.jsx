export default function DashboardLayout({ children }) {
  return (
    <div style={{ display: "flex", height: "100vh" }}>

      {/* 🟢 SIDEBAR (required in GIS systems) */}
      <div style={{
        width: "240px",
        background: "#1f2937",
        color: "white",
        padding: "15px"
      }}>
        <h3>🗺 LRMIS SYSTEM</h3>

        <hr />

        <p>📊 Dashboard</p>
        <p>👤 Applicants</p>
        <p>🧑‍💼 Surveyors</p>
        <p>🗺 GIS Map</p>
      </div>

      {/* 🟢 MAIN AREA */}
      <div style={{
        flex: 1,
        background: "#f3f4f6",
        padding: "10px"
      }}>
        {children}
      </div>

    </div>
  );
}