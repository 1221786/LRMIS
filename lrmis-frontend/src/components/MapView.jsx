import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";

const applicantIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/149/149071.png",
  iconSize: [35, 35],
});

const busyIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/190/190411.png",
  iconSize: [35, 35],
});

const freeIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/1995/1995574.png",
  iconSize: [35, 35],
});

export default function MapView({ applicants = [], surveyors = [] }) {

  // 🔵 Lines between applicant and assigned surveyor
  const lines = applicants
    .filter(a => a.latitude && a.longitude && a.assigned_surveyor)
    .map(a => {
      const s = surveyors.find(x => x.name === a.assigned_surveyor);

      if (!s || !s.latitude || !s.longitude) return null;

      return {
        from: [a.latitude, a.longitude],
        to: [s.latitude, s.longitude]
      };
    })
    .filter(Boolean);

  return (
    <MapContainer
      center={[31.5, 35]}
      zoom={9}
      style={{ height: "600px", width: "100%", borderRadius: "12px" }}
    >

      {/* 🗺 Base Map */}
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      {/* 🟢 Applicants */}
      {applicants.map((a, i) => (
        a.latitude && a.longitude ? (
          <Marker
            key={`app-${i}`}
            position={[a.latitude, a.longitude]}
            icon={applicantIcon}
          >
            <Popup>
              <b>Applicant</b><br />
              Name: {a.name}<br />
              Status: {a.status}<br />
              Assigned: {a.assigned_surveyor || "Not assigned"}
            </Popup>
          </Marker>
        ) : null
      ))}

      {/* 🟠 Surveyors */}
      {surveyors.map((s, i) => (
        s.latitude && s.longitude ? (
          <Marker
            key={`sur-${i}`}
            position={[s.latitude, s.longitude]}
            icon={s.status === "busy" ? busyIcon : freeIcon}
          >
            <Popup>
              <b>Surveyor</b><br />
              Name: {s.name}<br />
              Status: {s.status}<br />
              Workload: {s.workload}
            </Popup>
          </Marker>
        ) : null
      ))}

      {/* 🔵 Connections */}
      {lines.map((l, i) => (
        <Polyline
          key={`line-${i}`}
          positions={[l.from, l.to]}
          color="blue"
          weight={3}
        />
      ))}

    </MapContainer>
  );
}