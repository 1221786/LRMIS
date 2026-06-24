import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import { useEffect, useState } from "react";
import axios from "axios";

const applicantIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/149/149071.png",
  iconSize: [32, 32],
});

const surveyorIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/1995/1995574.png",
  iconSize: [32, 32],
});

export default function GISMap() {

  const [data, setData] = useState({ applicants: [], surveyors: [] });

  useEffect(() => {
    axios.get("http://127.0.0.1:8000/gis/data")
      .then(res => setData(res.data));
  }, []);

  const lines = data.applicants
    .filter(a => a.latitude && a.longitude && a.assigned_surveyor)
    .map(a => {
      const s = data.surveyors.find(x => x.name === a.assigned_surveyor);
      if (!s) return null;

      return {
        from: [a.latitude, a.longitude],
        to: [s.latitude, s.longitude]
      };
    }).filter(Boolean);

  return (
    <div className="gis-container">

      {/* HEADER */}
      <div className="gis-header">
        🌍 Live GIS Dashboard - LRMIS
      </div>

      <MapContainer
        center={[31.5, 35]}
        zoom={9}
        className="map"
      >

        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {/* Applicants */}
        {data.applicants.map((a, i) => (
          a.latitude ? (
            <Marker key={i} position={[a.latitude, a.longitude]} icon={applicantIcon}>
              <Popup>
                <b>Applicant</b><br />
                {a.name}<br />
                Status: {a.status}
              </Popup>
            </Marker>
          ) : null
        ))}

        {/* Surveyors */}
        {data.surveyors.map((s, i) => (
          s.latitude ? (
            <Marker key={i} position={[s.latitude, s.longitude]} icon={surveyorIcon}>
              <Popup>
                <b>Surveyor</b><br />
                {s.name}<br />
                Status: {s.status}
              </Popup>
            </Marker>
          ) : null
        ))}

        {/* Lines */}
        {lines.map((l, i) => (
          <Polyline key={i} positions={[l.from, l.to]} color="blue" />
        ))}

      </MapContainer>
    </div>
  );
}