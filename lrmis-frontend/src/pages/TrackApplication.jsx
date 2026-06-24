import { useState } from "react";
import axios from "axios";

export default function TrackApplication() {

  const [id, setId] = useState("");
  const [app, setApp] = useState(null);

  const search = () => {
    axios.get(`http://127.0.0.1:8000/applications/${id}`)
      .then(res => setApp(res.data))
      .catch(err => {
        console.log(err);
        alert("Application not found");
      });
  };

  return (
    <div className="container">

      <h2>Track Application</h2>

      <input
        placeholder="Enter Application ID"
        onChange={(e) => setId(e.target.value)}
      />

      <button onClick={search}>
        Search
      </button>

      {app && (
        <div className="card">

          <h3>Application Details</h3>

          <p><b>ID:</b> {app.application_id}</p>
          <p><b>Status:</b> {app.status}</p>
          <p><b>Type:</b> {app.type}</p>

          <h4>Applicant</h4>
          <p>{app.applicant?.name || "N/A"}</p>

          <h4>Parcel</h4>
          <p>{app.parcel?.parcel_number}</p>

          <h4>Timeline</h4>
          <ul>
            {app.timeline?.map((t, i) => (
              <li key={i}>
                {t.status} - {new Date(t.time).toLocaleString()}
              </li>
            ))}
          </ul>

        </div>
      )}

    </div>
  );
}