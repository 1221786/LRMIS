import { useEffect, useState } from "react";
import axios from "axios";

export default function ApplicantDashboard() {

  const [applications, setApplications] = useState([]);

  useEffect(() => {
    axios.get("http://127.0.0.1:8000/applications")
      .then((res) => {
        console.log("BACKEND RESPONSE:", res.data);

        // 🔥 FIX IMPORTANT
        setApplications(res.data.data || res.data || []);
      })
      .catch((err) => console.log(err));
  }, []);

  return (
    <div>

      {/* HEADER */}
      <div className="header">
        👤 Applicant Dashboard
      </div>

      {/* STATS */}
      <div className="grid">

        <div className="card">
          <h3>Total Applications</h3>
          <p>{applications.length}</p>
        </div>

        <div className="card">
          <h3>Pending</h3>
          <p>{applications.filter(a => a.status !== "approved").length}</p>
        </div>

        <div className="card">
          <h3>Approved</h3>
          <p>{applications.filter(a => a.status === "approved").length}</p>
        </div>

        <div className="card">
          <h3>Rejected</h3>
          <p>{applications.filter(a => a.status === "rejected").length}</p>
        </div>

      </div>

      {/* LIST */}
      <div style={{ padding: "20px" }}>

        {applications.length === 0 && (
          <div className="card">
            No applications found in system
          </div>
        )}

        {applications.map((app, i) => (
          <div key={i} className="card" style={{ marginBottom: "10px" }}>

            <h3>📄 {app.application_id}</h3>

            <p><b>Status:</b> {app.status}</p>

            <p><b>Applicant:</b> {app.applicant?.name || "N/A"}</p>

            <p><b>Type:</b> {app.type || "Land Registration"}</p>

            <p><b>Created:</b> {app.created_at}</p>

          </div>
        ))}

      </div>

    </div>
  );
}