import { useEffect, useState } from "react";
import axios from "axios";

export default function StaffDashboard() {

  const [data, setData] = useState(null);

  useEffect(() => {
    axios.get("http://127.0.0.1:8000/staff/dashboard")
      .then(res => setData(res.data));
  }, []);

  if (!data) return <p>Loading...</p>;

  return (
    <div>

      <h2 className="page-title">Staff Dashboard</h2>

      <div className="grid">

        <div className="card">Total: {data.total_applications}</div>
        <div className="card">Pending: {data.pending_review}</div>
        <div className="card">Survey: {data.under_survey}</div>
        <div className="card">Legal: {data.legal_review}</div>

      </div>

    </div>
  );
}