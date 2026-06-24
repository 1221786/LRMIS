import { useState } from "react";
import Login from "./pages/Login";
import ApplicantDashboard from "./pages/ApplicantDashboard";
import SubmitApplication from "./pages/SubmitApplication";
import TrackApplication from "./pages/TrackApplication";
import StaffDashboard from "./pages/StaffDashboard";
import GISMap from "./pages/GISMap";
import "./styles.css";

function App() {

  const [user, setUser] = useState(null);

  if (!user) return <Login setUser={setUser} />;

  return (
    <div>

      {user === "applicant" && <ApplicantDashboard />}
      {user === "submit" && <SubmitApplication />}
      {user === "track" && <TrackApplication />}
      {user === "staff" && <StaffDashboard />}
      {user === "admin" && <GISMap />}

      {!["applicant","submit","track","staff","admin"].includes(user) && (
        <div className="header">
          System Loading...
        </div>
      )}

    </div>
  );
}

export default App;