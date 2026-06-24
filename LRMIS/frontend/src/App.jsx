const API = "http://127.0.0.1:8004";
const states = ["submitted","pre_checked","survey_required","surveyed","legal_review","approved","certificate_issued","closed"];
const appTypes = ["first_registration","ownership_transfer","parcel_subdivision","parcel_merge","boundary_correction","certificate_request"];

function useApi(path, fallback) {
  const [data, setData] = React.useState(fallback);
  const load = React.useCallback(() => fetch(API + path).then(r => r.json()).then(setData).catch(() => setData(fallback)), [path]);
  React.useEffect(() => { load(); }, [load]);
  return [data, load, setData];
}

async function api(path, options = {}) {
  const res = await fetch(API + path, { headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Request failed");
  return data;
}

function App() {
  const [page, setPage] = React.useState(localStorage.getItem("role") || "Applicant");
  const [message, setMessage] = React.useState("");
  const pages = ["Applicant", "Staff", "Surveyor", "Registrar", "Map", "Analytics"];
  const show = (msg) => { setMessage(msg); setTimeout(() => setMessage(""), 5000); };
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">LRMIS</div>
        <div className="subtitle">Land Registration Management Information System</div>
        <div className="nav">{pages.map(p => <button key={p} className={page === p ? "active" : ""} onClick={() => { localStorage.setItem("role", p); setPage(p); }}>{p}</button>)}</div>
      </aside>
      <main className="main">
        <div className="topbar">
          <h1>{page}</h1>
          <button className="btn secondary" onClick={() => api("/seed", { method: "POST" }).then(() => show("Sample data inserted")).catch(e => show(e.message))}>Seed Sample Data</button>
        </div>
        {message && <div className="notice">{message}</div>}
        {page === "Applicant" && <Applicant show={show} />}
        {page === "Staff" && <Staff show={show} />}
        {page === "Surveyor" && <Surveyor show={show} />}
        {page === "Registrar" && <Registrar show={show} />}
        {page === "Map" && <MapPage />}
        {page === "Analytics" && <Analytics />}
      </main>
    </div>
  );
}

function Applicant({ show }) {
  const [apps, reload] = useApi("/applications", { items: [] });
  const [form, setForm] = React.useState({ application_type: "ownership_transfer", full_name: "Nour Ahmad", national_id: "400000001", phone: "+970599000001", email: "nour2@example.com", parcel_number: "146", block_number: "12", basin_number: "3", zone_id: "ZONE-RM-01", area_sqm: 910 });
  const submit = async () => {
    const body = {
      application_type: form.application_type,
      applicant: { full_name: form.full_name, applicant_type: "citizen", national_id: form.national_id, phone: form.phone, email: form.email, city: "Ramallah", neighborhood: "Al Tireh", zone_id: form.zone_id },
      parcel: {
        parcel_number: form.parcel_number, block_number: form.block_number, basin_number: form.basin_number, zone_id: form.zone_id, area_sqm: Number(form.area_sqm), land_use: "residential",
        geometry: { type: "Polygon", coordinates: [[[35.202,31.902],[35.203,31.902],[35.203,31.903],[35.202,31.903],[35.202,31.902]]] }
      },
      documents: [{ document_type: "ownership_deed", file_name: "deed.pdf", file_url: "/uploads/deed.pdf", status: "pending_review" }, { document_type: "id_copy", file_name: "id.pdf", file_url: "/uploads/id.pdf", status: "pending_review" }]
    };
    const app = await api("/applications/", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(body) });
    show(`Application submitted: ${app.application_id}`);
    reload();
  };
  return (
    <>
      <div className="grid"><Metric label="My Applications" value={apps.total || 0} /><Metric label="Pending" value={(apps.items || []).filter(a => !["closed","rejected"].includes(a.status)).length} /><Metric label="Missing Documents" value={(apps.items || []).filter(a => a.status === "missing_documents").length} /><Metric label="Certificates Ready" value={(apps.items || []).filter(a => a.status === "certificate_issued").length} /></div>
      <div className="panel">
        <h2>Submit Land Application</h2>
        <div className="form-grid">
          <Field label="Application Type"><select value={form.application_type} onChange={e => setForm({...form, application_type: e.target.value})}>{appTypes.map(t => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Full Name"><input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} /></Field>
          <Field label="National ID"><input value={form.national_id} onChange={e => setForm({...form, national_id: e.target.value})} /></Field>
          <Field label="Phone"><input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></Field>
          <Field label="Email"><input value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></Field>
          <Field label="Parcel Number"><input value={form.parcel_number} onChange={e => setForm({...form, parcel_number: e.target.value})} /></Field>
          <Field label="Block"><input value={form.block_number} onChange={e => setForm({...form, block_number: e.target.value})} /></Field>
          <Field label="Basin"><input value={form.basin_number} onChange={e => setForm({...form, basin_number: e.target.value})} /></Field>
          <Field label="Zone"><input value={form.zone_id} onChange={e => setForm({...form, zone_id: e.target.value})} /></Field>
        </div>
        <div className="toolbar" style={{marginTop: 12}}><button className="btn" onClick={submit}>Submit Application</button></div>
      </div>
      <ApplicationTable apps={apps.items || []} />
    </>
  );
}

function Staff({ show }) {
  const [apps, reload] = useApi("/applications", { items: [] });
  const change = (id, status) => api(`/applications/${id}/transition`, { method: "PATCH", body: JSON.stringify({ new_status: status, note: `Moved to ${status}` }) }).then(() => { show("Status changed"); reload(); }).catch(e => show(e.message));
  const assign = (id) => api(`/applications/${id}/auto-assign-surveyor`, { method: "POST" }).then(r => { show(`Assigned ${r.surveyor.name}, task ${r.task.task_id}`); reload(); }).catch(e => show(e.message));
  return <Management apps={apps.items || []} reload={reload} actions={(a) => <><select onChange={e => e.target.value && change(a.application_id, e.target.value)} defaultValue=""><option value="">Change status</option>{(a.workflow?.allowed_next || []).map(s => <option key={s}>{s}</option>)}</select><button className="btn secondary" onClick={() => assign(a.application_id)}>Assign Surveyor</button></>} />;
}

function Surveyor({ show }) {
  const [tasks, reload] = useApi("/survey-tasks", []);
  const next = { assigned: "visit_scheduled", visit_scheduled: "arrived_on_site", arrived_on_site: "survey_started", survey_started: "survey_completed", survey_completed: "report_uploaded" };
  const milestone = (t) => api(`/applications/${t.application_id}/survey-milestone`, { method: "PATCH", body: JSON.stringify({ milestone: next[t.status] || "visit_scheduled", note: "Updated by surveyor" }) }).then(() => { show("Milestone updated"); reload(); }).catch(e => show(e.message));
  const report = (t) => api(`/applications/${t.application_id}/survey-report`, { method: "POST", body: JSON.stringify({ summary: "Boundary verified successfully.", boundary_matches: true, area_sqm_measured: 850.5, has_dispute: false }) }).then(() => { show("Survey report uploaded"); reload(); }).catch(e => show(e.message));
  return <div className="panel"><h2>My Survey Tasks</h2><table><thead><tr><th>Task</th><th>Status</th><th>Priority</th><th>Action</th></tr></thead><tbody>{tasks.map(t => <tr key={t._id}><td>{t.task_id}</td><td><span className="status">{t.status}</span></td><td>{t.priority}</td><td className="toolbar"><button className="btn secondary" onClick={() => milestone(t)}>Next Milestone</button><button className="btn" onClick={() => report(t)}>Upload Report</button></td></tr>)}</tbody></table></div>;
}

function Registrar({ show }) {
  const [apps, reload] = useApi("/applications", { items: [] });
  const review = (id) => api(`/applications/${id}/registrar-review`, { method: "PATCH", body: JSON.stringify({ decision: "approved", note: "All legal documents verified" }) }).then(() => { show("Application approved"); reload(); }).catch(e => show(e.message));
  const cert = (id) => api(`/applications/${id}/certificate`, { method: "POST" }).then(r => { show(`Certificate generated: ${r.certificate_id}`); reload(); }).catch(e => show(e.message));
  return <Management apps={apps.items || []} reload={reload} actions={(a) => <><button className="btn secondary" onClick={() => review(a.application_id)}>Approve</button><button className="btn" onClick={() => cert(a.application_id)}>Generate Certificate</button></>} />;
}

function MapPage() {
  React.useEffect(() => {
    const map = L.map("map").setView([31.9026, 35.201], 16);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    fetch(API + "/analytics/geofeeds/parcels").then(r => r.json()).then(fc => {
      L.geoJSON(fc, { onEachFeature: (feature, layer) => layer.bindPopup(`<b>${feature.properties.parcel_code}</b><br>Status: ${feature.properties.application_status || "no application"}<br>Zone: ${feature.properties.zone_id}`) }).addTo(map);
    });
    return () => map.remove();
  }, []);
  return <div className="panel"><h2>Live Parcel Map</h2><div id="map"></div></div>;
}

function Analytics() {
  const [k] = useApi("/analytics/kpis", {});
  const [status] = useApi("/analytics/applications-by-status", []);
  const [zone] = useApi("/analytics/applications-by-zone", []);
  return <><div className="grid"><Metric label="Total" value={k.total_applications || 0}/><Metric label="Pending" value={k.pending_applications || 0}/><Metric label="Approved" value={k.approved_applications || 0}/><Metric label="Certificates" value={k.certificates_issued || 0}/></div><Bars title="Applications by Status" rows={status}/><Bars title="Applications by Zone" rows={zone}/></>;
}

function Management({ apps, actions }) {
  return <><div className="grid"><Metric label="Total Pending" value={apps.filter(a => !["closed","rejected"].includes(a.status)).length}/><Metric label="Legal Review" value={apps.filter(a => a.status === "legal_review").length}/><Metric label="Objections" value={apps.filter(a => a.status === "under_objection").length}/><Metric label="Approved" value={apps.filter(a => a.status === "approved").length}/></div><ApplicationTable apps={apps} actions={actions} /></>;
}

function ApplicationTable({ apps, actions }) {
  return <div className="panel"><h2>Applications</h2><table><thead><tr><th>ID</th><th>Applicant</th><th>Type</th><th>Parcel</th><th>Zone</th><th>Status</th><th>Workflow</th><th>Actions</th></tr></thead><tbody>{apps.map(a => <tr key={a._id}><td>{a.application_id}</td><td>{a.applicant_ref?.full_name}</td><td>{a.application_type}</td><td>{a.parcel_ref?.parcel_number}</td><td>{a.parcel_ref?.zone_id}</td><td><span className="status">{a.status}</span></td><td><div className="timeline">{states.map(s => <span key={s} className={"step " + (states.indexOf(s) <= states.indexOf(a.status) ? "done" : "")}>{s}</span>)}</div></td><td className="toolbar">{actions ? actions(a) : <a href={`${API}/applications/${a.application_id}`} target="_blank">JSON</a>}</td></tr>)}</tbody></table></div>;
}

function Bars({ title, rows }) {
  const max = Math.max(...rows.map(r => r.count), 1);
  return <div className="panel"><h2>{title}</h2><div className="bars">{rows.map(r => <div className="bar" key={r._id || "none"}><span>{r._id || "none"}</span><span style={{"--w": `${(r.count / max) * 100}%`}}></span><b>{r.count}</b></div>)}</div></div>;
}

function Metric({ label, value }) { return <div className="card"><div>{label}</div><div className="metric">{value}</div></div>; }
function Field({ label, children }) { return <label>{label}{children}</label>; }

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
