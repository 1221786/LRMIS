import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import Student1Dashboard from "./Student1Dashboard.jsx";
import Student2App, {
  Student2ApplicationsPage,
  Student2ApplicationDetailsPage,
  Student2CertificatesPage,
  Student2CommentsPage,
  Student2Dashboard,
  Student2DocumentsPage,
  Student2NewApplicationPage,
  Student2NotificationsPage,
  Student2ObjectionsPage,
  Student2ProfilePage,
  Student2ReviewPage,
  Student2SettingsPage,
  Student2StaffConsolePage,
  Student2TrackPage,
} from "./Student2App.jsx";
import Student3App, {
  Student3AnalyticsPage,
  Student3Dashboard,
  Student3ExecutionPage,
  Student3MapPage,
  Student3ReportsPage,
  Student3TasksPage,
} from "./Student3App.jsx";
import MultiPageApp, {
  ApplicationDetailsPage as MultiApplicationDetailsPage,
  ApplicationConfirmationPage,
  ApplicationsPage as MultiApplicationsPage,
  CertificatesPage,
  DashboardPage,
  DocumentsPage,
  LogsPage,
  MapPage,
  ObjectionsPage,
  ReportsPage,
  SettingsPage,
  SubmitApplicationPage as MultiSubmitApplicationPage,
  TrackApplicationPage as MultiTrackApplicationPage,
  WorkflowPage,
} from "./MultiPageApp.jsx";
import {
  getApplications,
  getApplication,
  getKpis,
  getByStatus,
  getByZone,
  getParcels,
  getProcessingTime,
  getSurveyors,
  getStaff,
  getSurveyTasks,
  getTimeline,
  login,
  logout,
  patchJson,
  postJson,
} from "./api/client";

const workflow = ["submitted", "pre_checked", "survey_required", "surveyed", "legal_review", "approved", "certificate_issued", "closed"];
const appTypes = ["ownership_transfer", "first_registration", "parcel_subdivision", "parcel_merge", "boundary_correction", "certificate_request"];

function getSession() {
  return {
    token: localStorage.getItem("access_token"),
    role: localStorage.getItem("role"),
    fullName: localStorage.getItem("full_name"),
    linkedId: localStorage.getItem("linked_id"),
  };
}

function saveSession(data) {
  localStorage.setItem("access_token", data.access_token);
  localStorage.setItem("role", data.role);
  localStorage.setItem("user_id", data.user_id);
  localStorage.setItem("linked_id", data.linked_id);
  localStorage.setItem("full_name", data.full_name);
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route element={<RequireAuth><MultiPageApp /></RequireAuth>}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/applications" element={<MultiApplicationsPage />} />
          <Route path="/applications/new" element={<MultiSubmitApplicationPage />} />
          <Route path="/applications/:id/confirmation" element={<ApplicationConfirmationPage />} />
          <Route path="/applications/:id" element={<MultiApplicationDetailsPage />} />
          <Route path="/applications/track/:id" element={<MultiTrackApplicationPage />} />
          <Route path="/workflow" element={<WorkflowPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/certificates" element={<CertificatesPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/objections" element={<ObjectionsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="/applicant" element={<Navigate to="/dashboard" replace />} />
        <Route path="/student1" element={<Student1Dashboard />} />
        <Route element={<RequireAuth><Student2App /></RequireAuth>}>
          <Route path="/student2" element={<Navigate to="/student2/dashboard" replace />} />
          <Route path="/student2/dashboard" element={<Student2Dashboard />} />
          <Route path="/student2/profile" element={<Student2ProfilePage />} />
          <Route path="/student2/applications" element={<Student2ApplicationsPage />} />
          <Route path="/student2/applications/new" element={<Student2NewApplicationPage />} />
          <Route path="/student2/applications/:id" element={<Student2TrackPage tab="overview" />} />
          <Route path="/student2/applications/:id/timeline" element={<Student2TrackPage tab="timeline" />} />
          <Route path="/student2/applications/:id/documents" element={<Student2TrackPage tab="documents" />} />
          <Route path="/student2/applications/:id/comments" element={<Student2TrackPage tab="comments" />} />
          <Route path="/student2/applications/:id/objections" element={<Student2TrackPage tab="objections" />} />
          <Route path="/student2/track/:id" element={<Student2TrackPage />} />
          <Route path="/student2/documents" element={<Student2DocumentsPage />} />
          <Route path="/student2/comments" element={<Student2CommentsPage />} />
          <Route path="/student2/objections" element={<Student2ObjectionsPage />} />
          <Route path="/student2/notifications" element={<Student2NotificationsPage />} />
          <Route path="/student2/staff" element={<Student2StaffConsolePage />} />
          <Route path="/student2/review" element={<Student2ReviewPage />} />
          <Route path="/student2/certificates" element={<Student2CertificatesPage />} />
          <Route path="/student2/settings" element={<Student2SettingsPage />} />
        </Route>
        <Route path="/staff" element={<ProtectedRoute role="staff"><Shell role="staff"><StaffPages /></Shell></ProtectedRoute>} />
        <Route element={<ProtectedRoute role="surveyor"><Student3App /></ProtectedRoute>}>
          <Route path="/student3" element={<Navigate to="/student3/dashboard" replace />} />
          <Route path="/student3/dashboard" element={<Student3Dashboard />} />
          <Route path="/student3/tasks" element={<Student3TasksPage />} />
          <Route path="/student3/execution" element={<Student3ExecutionPage />} />
          <Route path="/student3/execution/:id" element={<Student3ExecutionPage />} />
          <Route path="/student3/map" element={<Student3MapPage />} />
          <Route path="/student3/analytics" element={<Student3AnalyticsPage />} />
          <Route path="/student3/reports" element={<Student3ReportsPage />} />
        </Route>
        <Route path="/survey/tasks" element={<Navigate to="/student3/tasks" replace />} />
        <Route path="/surveyor" element={<Navigate to="/student3/dashboard" />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

function ProtectedRoute({ role, children }) {
  const session = getSession();
  if (!session.token) return <Navigate to="/login" replace />;
  if (session.role !== role) return <Navigate to="/unauthorized" replace />;
  return children;
}

function RequireAuth({ children }) {
  const session = getSession();
  if (!session.token) return <Navigate to="/login" replace />;
  return children;
}

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await login(username, password);
      saveSession(data);
      if (data.role === "applicant") navigate("/student2/dashboard");
      else if (data.role === "staff" || data.role === "registrar") navigate("/student1");
      else if (data.role === "surveyor") navigate("/student3/dashboard");
      else navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid username or password");
    } finally {
      setLoading(false);
    }
  }

  function demo(user) {
    setUsername(user);
    setPassword("123456");
  }

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <div className="auth-logo"><span>LR</span><strong>LRMIS</strong></div>
        <h1>Land Registration<br />Management System</h1>
        <p>A secure, transparent and efficient system for managing land registration, surveys, reviews and certificates.</p>
        <CityIllustration />
        <div className="feature-row">
          <Feature title="Secure System" text="Role based access control" />
          <Feature title="Smart Workflow" text="Automated application processing" />
          <Feature title="Transparent Process" text="Track every step in real time" />
        </div>
      </section>
      <section className="auth-form-zone">
        <form className="login-card" onSubmit={submit}>
          <div className="login-avatar">u</div>
          <h2>Welcome Back</h2>
          <p>Please sign in to continue to LRMIS</p>
          {error && <div className="auth-error">{error}</div>}
          <label>Username
            <span className="input-shell"><input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter your username" autoComplete="username" /><b>u</b></span>
          </label>
          <label>Password
            <span className="input-shell"><input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" /><button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Hide" : "Show"}</button></span>
          </label>
          <div className="login-options">
            <label className="remember"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me</label>
            <button type="button" className="link-button">Forgot password?</button>
          </div>
          <button className="login-button" disabled={loading}>{loading ? "Signing in..." : "Login"}</button>
          <div className="demo-title">Demo Accounts</div>
          <div className="demo-grid">
            <button type="button" onClick={() => demo("applicant1")}><b>Applicant</b><span>applicant1</span><span>123456</span></button>
            <button type="button" onClick={() => demo("staff1")}><b>Staff / Registrar</b><span>staff1</span><span>123456</span></button>
            <button type="button" onClick={() => demo("surveyor1")}><b>Surveyor</b><span>surveyor1</span><span>123456</span></button>
          </div>
        </form>
        <footer className="auth-footer">© 2026 LRMIS - All rights reserved.</footer>
      </section>
    </main>
  );
}

function CityIllustration() {
  return <div className="city-scene"><span className="tower t1" /><span className="tower t2" /><span className="tower t3" /><span className="tower t4" /><span className="plot p1" /><span className="plot p2" /><span className="water" /></div>;
}

function Feature({ title, text }) {
  return <div className="feature"><span>i</span><b>{title}</b><small>{text}</small></div>;
}

function Unauthorized() {
  return <main className="center-page"><section className="login-card small"><h2>Unauthorized</h2><p>Your role cannot open this page.</p><Link className="login-button as-link" to="/login">Back to Login</Link></section></main>;
}

function Shell({ role, children }) {
  const navigate = useNavigate();
  const session = getSession();
  const nav = {
    applicant: [["Dashboard", "/applicant"], ["Submit Application", "/applicant"], ["Track Application", "/applicant"]],
    staff: [["Dashboard", "/staff"], ["Applications", "/staff"], ["Registrar Review", "/staff"], ["Certificates", "/staff"], ["Analytics", "/staff"]],
    surveyor: [["My Tasks", "/survey/tasks"], ["Live Map", "/survey/tasks"]],
  }[role];

  async function signOut() {
    await logout().catch(() => null);
    localStorage.clear();
    navigate("/login");
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-wrap"><div className="brand-mark">L</div><div className="brand">LRMIS</div></div>
        <div className="subtitle">Land Registration Management Information System</div>
        <nav className="nav">{nav.map(([label, to]) => <Link to={to} key={label}>{label}</Link>)}</nav>
        <button className="logout-link" onClick={signOut}>Logout</button>
      </aside>
      <section className="main">
        <header className="topbar">
          <div><div className="page-kicker">{role.toUpperCase()} DASHBOARD</div><h1>Welcome back, {session.fullName}</h1></div>
          <div className="user-chip"><span>{role[0].toUpperCase()}</span><div><b>{session.fullName}</b><small>{role}</small></div></div>
        </header>
        {children}
      </section>
    </div>
  );
}

function useApplications() {
  const [apps, setApps] = useState([]);
  const [error, setError] = useState("");
  const load = async () => {
    try {
      const data = await getApplications();
      setApps(data.items || []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
  };
  useEffect(() => { load(); }, []);
  return { apps, error, reload: load };
}

function ApplicantPages() {
  const { apps, error, reload } = useApplications();
  const [page, setPage] = useState("dashboard");
  const [selectedId, setSelectedId] = useState("");
  const [timeline, setTimeline] = useState(null);
  const [message, setMessage] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [coords, setCoords] = useState([
    [35.2, 31.902],
    [35.201, 31.902],
    [35.201, 31.903],
    [35.2, 31.903],
    [35.2, 31.902],
  ]);
  const [form, setForm] = useState({
    application_type: "ownership_transfer",
    priority: "normal",
    description: "Ownership transfer request",
    full_name: localStorage.getItem("full_name") || "Applicant",
    national_id: `40${String(Date.now()).slice(-7)}`,
    phone: "+970599000000",
    email: "applicant@example.com",
    address: "Ramallah",
    applicant_type: "citizen",
    parcel_number: "145",
    block_number: "12",
    basin_number: "3",
    zone_id: "ZONE-RM-01",
    area_sqm: "600.5",
    land_use: "residential",
    document_type: "ownership_deed",
    document_file: "ownership_deed.pdf",
    objection_reason: "Boundary overlap objection details.",
  });
  const selected = apps.find((item) => item.application_id === selectedId) || apps[0];

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submitApplication() {
    const created = await postJson("/applications/", {
      application_type: form.application_type,
      priority: form.priority,
      description: form.description,
      applicant: {
        full_name: form.full_name,
        national_id: form.national_id,
        contacts: { email: form.email, phone: form.phone },
        address: { city: form.address },
        type: form.applicant_type,
      },
      parcel: {
        parcel_number: form.parcel_number,
        block_number: form.block_number,
        basin_number: form.basin_number,
        zone_id: form.zone_id,
        area_sqm: Number(form.area_sqm),
        land_use: form.land_use,
        geometry: { type: "Polygon", coordinates: [coords] },
      },
      documents: requiredDocTypes(form.application_type).map((documentType) => ({
        document_type: documentType,
        file_name: `${documentType}.pdf`,
        file_url: `/uploads/${documentType}.pdf`,
        status: "pending_review",
      })),
    }, { "Idempotency-Key": crypto.randomUUID() });
    setConfirmation(created);
    setSelectedId(created.application_id);
    setPage("confirmation");
    setMessage("Application submitted through protected API.");
    reload();
  }

  async function uploadDocument() {
    if (!selected) return;
    await postJson(`/applications/${selected.application_id}/documents`, {
      document_type: form.document_type,
      file_name: form.document_file,
      file_url: `/uploads/${form.document_file}`,
      status: "pending_review",
      uploaded_by: { role: "applicant", id: localStorage.getItem("linked_id") },
    });
    setMessage("Document uploaded through protected API.");
    setPage("track");
    reload();
  }

  async function submitObjection() {
    if (!selected) return;
    await postJson(`/applications/${selected.application_id}/objections`, {
      reason: form.objection_reason,
      submitted_by: { role: "applicant", id: localStorage.getItem("linked_id") },
      supporting_documents: [],
    });
    setMessage("Objection submitted through protected API.");
    setPage("track");
    reload();
  }

  async function loadTimeline(id) {
    setSelectedId(id);
    setTimeline(await getTimeline(id));
    setPage("track");
  }

  return (
    <>
      {error && <Notice>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      <div className="portal-tabs">
        {["dashboard", "submit", "track", "upload", "objection"].map((tab) => <button className={page === tab ? "active" : ""} key={tab} onClick={() => setPage(tab)}>{tab}</button>)}
      </div>
      {page === "dashboard" && <ApplicantDashboard apps={apps} setPage={setPage} onTrack={loadTimeline} />}
      {page === "submit" && <SubmitApplicationPage form={form} updateForm={updateForm} coords={coords} setCoords={setCoords} submitApplication={submitApplication} setPage={setPage} />}
      {page === "confirmation" && <ConfirmationPage application={confirmation} coords={coords} setPage={setPage} onTrack={loadTimeline} />}
      {page === "track" && <TrackApplicationPage apps={apps} selected={selected} selectedId={selectedId} setSelectedId={setSelectedId} timeline={timeline} loadTimeline={loadTimeline} setPage={setPage} />}
      {page === "upload" && <UploadDocumentsPage selected={selected} form={form} updateForm={updateForm} uploadDocument={uploadDocument} setPage={setPage} />}
      {page === "objection" && <ObjectionPage selected={selected} form={form} updateForm={updateForm} submitObjection={submitObjection} setPage={setPage} />}
    </>
  );
}

function requiredDocTypes(applicationType) {
  return {
    first_registration: ["id_copy", "proof_of_ownership", "parcel_map"],
    ownership_transfer: ["id_copy", "ownership_deed", "sale_contract"],
    parcel_subdivision: ["id_copy", "ownership_deed", "subdivision_plan", "survey_report"],
    parcel_merge: ["id_copy", "ownership_deed", "merge_plan", "survey_report"],
    boundary_correction: ["id_copy", "ownership_deed", "boundary_correction_request", "survey_report"],
    certificate_request: ["id_copy", "parcel_reference", "proof_of_ownership"],
  }[applicationType] || [];
}

function ApplicantDashboard({ apps, setPage, onTrack }) {
  return (
    <>
      <DashboardCards apps={apps} />
      <section className="app-table-panel">
        <div className="panel-head">
          <h2>Recent Applications</h2>
          <div className="toolbar">
            <button className="btn" onClick={() => setPage("submit")}>Submit New Application</button>
            <button className="btn secondary" onClick={() => setPage("track")}>Track Application</button>
          </div>
        </div>
        <ApplicationsTable apps={apps} onTrack={onTrack} />
      </section>
    </>
  );
}

function SubmitApplicationPage({ form, updateForm, coords, setCoords, submitApplication, setPage }) {
  return (
    <section className="panel">
      <div className="panel-head"><h2>Submit Land Application</h2><button className="btn secondary" onClick={() => setPage("dashboard")}>Cancel</button></div>
      <div className="stepper">{["Application Information", "Applicant Information", "Parcel Information", "Map Section", "Required Documents"].map((s, i) => <div className="wizard-step done" key={s}><b>{i + 1}</b><span>{s}</span></div>)}</div>
      <h3>Application Information</h3>
      <div className="form-grid">
        <label>Application Type<select value={form.application_type} onChange={(e) => updateForm("application_type", e.target.value)}>{appTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
        <label>Priority<select value={form.priority} onChange={(e) => updateForm("priority", e.target.value)}><option>normal</option><option>high</option><option>urgent</option></select></label>
        <label>Description<input value={form.description} onChange={(e) => updateForm("description", e.target.value)} /></label>
      </div>
      <h3>Applicant Information</h3>
      <div className="form-grid">
        <label>Full Name<input value={form.full_name} onChange={(e) => updateForm("full_name", e.target.value)} /></label>
        <label>National ID / Registration No.<input value={form.national_id} onChange={(e) => updateForm("national_id", e.target.value)} /></label>
        <label>Phone<input value={form.phone} onChange={(e) => updateForm("phone", e.target.value)} /></label>
        <label>Email<input value={form.email} onChange={(e) => updateForm("email", e.target.value)} /></label>
        <label>Address<input value={form.address} onChange={(e) => updateForm("address", e.target.value)} /></label>
        <label>Applicant Type<select value={form.applicant_type} onChange={(e) => updateForm("applicant_type", e.target.value)}><option>citizen</option><option>lawyer</option><option>company</option><option>representative</option></select></label>
      </div>
      <h3>Parcel Information</h3>
      <div className="form-grid">
        <label>Parcel Number<input value={form.parcel_number} onChange={(e) => updateForm("parcel_number", e.target.value)} /></label>
        <label>Block Number<input value={form.block_number} onChange={(e) => updateForm("block_number", e.target.value)} /></label>
        <label>Basin Number<input value={form.basin_number} onChange={(e) => updateForm("basin_number", e.target.value)} /></label>
        <label>Zone<input value={form.zone_id} onChange={(e) => updateForm("zone_id", e.target.value)} /></label>
        <label>Area sqm<input value={form.area_sqm} onChange={(e) => updateForm("area_sqm", e.target.value)} /></label>
        <label>Land Use<select value={form.land_use} onChange={(e) => updateForm("land_use", e.target.value)}><option>residential</option><option>commercial</option><option>agricultural</option></select></label>
      </div>
      <h3>Map Section</h3>
      <MapPicker coords={coords} setCoords={setCoords} />
      <h3>Required Documents</h3>
      <div className="document-list">{requiredDocTypes(form.application_type).map((doc) => <span className="status" key={doc}>{doc}.pdf</span>)}</div>
      <div className="toolbar"><button className="btn secondary" onClick={() => setCoords(coords)}>Choose Location on Map</button><button className="btn secondary">Upload Document</button><button className="btn secondary">Remove Document</button><button className="btn" onClick={submitApplication}>Submit Application</button></div>
    </section>
  );
}

function MapPicker({ coords, setCoords }) {
  const mapRef = useRef(null);
  const holderRef = useRef(null);
  useEffect(() => {
    if (!holderRef.current || mapRef.current) return;
    const map = L.map(holderRef.current).setView([31.9025, 35.2007], 17);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "OpenStreetMap" }).addTo(map);
    const polygon = L.polygon(coords.map(([lng, lat]) => [lat, lng]), { color: "#0f62d6" }).addTo(map);
    map.on("click", (event) => {
      const lng = Number(event.latlng.lng.toFixed(6));
      const lat = Number(event.latlng.lat.toFixed(6));
      const next = [[lng, lat], [lng + 0.001, lat], [lng + 0.001, lat + 0.001], [lng, lat + 0.001], [lng, lat]];
      polygon.setLatLngs(next.map(([x, y]) => [y, x]));
      setCoords(next);
    });
    mapRef.current = map;
  }, [coords, setCoords]);
  return <div className="map-compose"><div ref={holderRef} className="leaflet-picker" /><pre>{JSON.stringify({ type: "Polygon", coordinates: [coords] }, null, 2)}</pre></div>;
}

function ConfirmationPage({ application, coords, setPage, onTrack }) {
  if (!application) return null;
  return <section className="panel confirmation"><div className="success-mark">OK</div><h2>Application Confirmation</h2><h1>{application.application_id}</h1><p>Current status: <Status value={application.status} /></p><p>Submitted date: {new Date(application.created_at).toLocaleString()}</p><p>Required next step: {nextStep(application.status)}</p><div className="mini-map"><pre>{JSON.stringify({ type: "Polygon", coordinates: [coords] }, null, 2)}</pre></div><div className="toolbar center"><button className="btn" onClick={() => onTrack(application.application_id)}>Track This Application</button><button className="btn secondary" onClick={() => setPage("submit")}>Submit Another Application</button><button className="btn secondary" onClick={() => setPage("dashboard")}>Back to Dashboard</button></div></section>;
}

function TrackApplicationPage({ apps, selected, selectedId, setSelectedId, timeline, loadTimeline, setPage }) {
  return <section className="panel"><div className="panel-head"><h2>Track Application</h2><button className="btn secondary" onClick={() => setPage("dashboard")}>Back</button></div><div className="toolbar"><select value={selectedId || selected?.application_id || ""} onChange={(e) => setSelectedId(e.target.value)}>{apps.map((app) => <option key={app.application_id}>{app.application_id}</option>)}</select><button className="btn" onClick={() => loadTimeline(selectedId || selected?.application_id)}>Search</button><button className="btn secondary" onClick={() => setPage("upload")}>Upload Missing Documents</button><button className="btn secondary" onClick={() => setPage("objection")}>Submit Objection</button></div>{selected && <div className="grid">{metric("Current Status", selected.status)}{metric("Missing Documents", (selected.required_documents || []).filter((d) => d.status === "missing").length)}{metric("Survey Status", selected.survey_report_exists ? "reported" : "pending")}{metric("Certificate", selected.certificate_ref ? "issued" : "not issued")}</div>}<div className="timeline">{workflow.map((step) => <span className={`step ${workflow.indexOf(step) <= workflow.indexOf(selected?.status) ? "done" : ""}`} key={step}>{step}</span>)}</div>{timeline && <TimelinePanel timeline={timeline} />}</section>;
}

function UploadDocumentsPage({ selected, form, updateForm, uploadDocument, setPage }) {
  return <section className="panel"><div className="panel-head"><h2>Upload Additional Documents</h2><button className="btn secondary" onClick={() => setPage("track")}>Cancel</button></div><div className="form-grid"><label>Application<input value={selected?.application_id || ""} readOnly /></label><label>Document Type<select value={form.document_type} onChange={(e) => updateForm("document_type", e.target.value)}>{requiredDocTypes(selected?.type || "ownership_transfer").map((doc) => <option key={doc}>{doc}</option>)}</select></label><label>File Name<input value={form.document_file} onChange={(e) => updateForm("document_file", e.target.value)} /></label></div><div className="toolbar"><button className="btn" onClick={uploadDocument}>Upload Document</button><button className="btn secondary" onClick={() => setPage("track")}>View Document Status</button></div></section>;
}

function ObjectionPage({ selected, form, updateForm, submitObjection, setPage }) {
  return <section className="panel"><div className="panel-head"><h2>Submit Objection</h2><button className="btn secondary" onClick={() => setPage("track")}>Cancel</button></div><div className="form-grid"><label>Application<input value={selected?.application_id || ""} readOnly /></label><label>Supporting Document<input value="objection_support.pdf" readOnly /></label><label>Objection Details<input value={form.objection_reason} onChange={(e) => updateForm("objection_reason", e.target.value)} /></label></div><div className="toolbar"><button className="btn secondary">Attach Document</button><button className="btn" onClick={submitObjection}>Submit Objection</button></div></section>;
}

function StaffPages() {
  const { apps, error, reload } = useApplications();
  const [kpis, setKpis] = useState(null);
  const [message, setMessage] = useState("");
  const [page, setPage] = useState("dashboard");
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({ status: "", type: "", zone: "", applicant: "", parcel: "" });
  const [note, setNote] = useState("Reviewed by staff.");
  const [decision, setDecision] = useState("Approved after legal document review.");
  const [lastCertificate, setLastCertificate] = useState(null);
  useEffect(() => { getKpis().then(setKpis).catch(() => null); }, [apps.length]);

  async function transition(id, newStatus) {
    await patchJson(`/applications/${id}/transition`, { target_state: newStatus, actor: { role: "staff", id: localStorage.getItem("linked_id") }, note: `Moved to ${newStatus}` });
    setMessage(`Application moved to ${newStatus}.`);
    reload();
    if (selected?.application_id === id) await openDetails(id);
  }

  async function assignSurveyor(id) {
    await postJson(`/applications/${id}/auto-assign-surveyor`, {});
    setMessage("Surveyor auto-assigned through protected API.");
    reload();
  }

  async function issueCertificate(id) {
    const result = await postJson(`/applications/${id}/certificate`, { issued_by: localStorage.getItem("linked_id") });
    setLastCertificate(result.certificate);
    setMessage(`Certificate generated: ${result.certificate?.certificate_id}`);
    reload();
  }

  async function openDetails(id) {
    const details = await getApplication(id);
    setSelected(details);
    setPage("details");
  }

  async function addInternalNote() {
    await postJson(`/applications/${selected.application_id}/internal-notes`, { note, visible_to_applicant: false });
    setMessage("Internal note saved in performance logs.");
    await openDetails(selected.application_id);
  }

  async function requestMissingDocuments() {
    const missing = (selected?.required_documents || []).filter((doc) => doc.status === "missing").map((doc) => doc.document_type);
    await postJson(`/applications/${selected.application_id}/request-missing-documents`, { document_types: missing.length ? missing : ["sale_contract"], note: "Please upload missing documents." });
    setMessage("Missing documents requested and notification stub created.");
    await openDetails(selected.application_id);
    reload();
  }

  async function reviewDocument(documentType, decisionValue) {
    await patchJson(`/applications/${selected.application_id}/documents/review`, { document_type: documentType, decision: decisionValue, rejection_reason: decisionValue === "rejected" ? "Document is not readable." : null });
    setMessage(`Document ${documentType} ${decisionValue}.`);
    await openDetails(selected.application_id);
  }

  async function registrarDecision() {
    await patchJson(`/applications/${selected.application_id}/registrar-review`, { decision, notes: decision, visible_to_applicant: true, actor: { role: "staff", id: localStorage.getItem("linked_id") } });
    setMessage("Registrar decision saved.");
    await openDetails(selected.application_id);
  }

  async function rejectSelected() {
    await postJson(`/applications/${selected.application_id}/reject`, { rejection_reason: "Rejected by registrar review.", rejected_by: localStorage.getItem("linked_id") });
    setMessage("Application rejected with reason.");
    await openDetails(selected.application_id);
    reload();
  }

  async function holdSelected() {
    await postJson(`/applications/${selected.application_id}/hold`, { hold_reason: "Waiting for external verification.", held_by: localStorage.getItem("linked_id") });
    setMessage("Application put on hold.");
    await openDetails(selected.application_id);
    reload();
  }

  const filteredApps = apps.filter((app) => {
    if (filters.status && app.status !== filters.status) return false;
    if (filters.type && app.type !== filters.type) return false;
    if (filters.zone && app.parcel_ref?.zone_id !== filters.zone) return false;
    if (filters.parcel && app.parcel_ref?.parcel_number !== filters.parcel) return false;
    if (filters.applicant && !(app.applicant_ref?.full_name || "").toLowerCase().includes(filters.applicant.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      {error && <Notice>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      <div className="portal-tabs">
        {["dashboard", "applications", "details", "registrar", "certificates", "map", "analytics"].map((tab) => <button className={page === tab ? "active" : ""} key={tab} onClick={() => setPage(tab)}>{tab}</button>)}
      </div>
      {page === "dashboard" && <StaffDashboard kpis={kpis} apps={apps} setPage={setPage} />}
      {page === "applications" && <ApplicationManagementTable apps={filteredApps} filters={filters} setFilters={setFilters} reload={reload} openDetails={openDetails} />}
      {page === "details" && <ApplicationDetailsPage selected={selected} setPage={setPage} transition={transition} addInternalNote={addInternalNote} requestMissingDocuments={requestMissingDocuments} rejectSelected={rejectSelected} holdSelected={holdSelected} assignSurveyor={assignSurveyor} note={note} setNote={setNote} />}
      {page === "registrar" && <RegistrarReviewPage selected={selected} apps={apps} openDetails={openDetails} reviewDocument={reviewDocument} registrarDecision={registrarDecision} transition={transition} rejectSelected={rejectSelected} requestMissingDocuments={requestMissingDocuments} decision={decision} setDecision={setDecision} />}
      {page === "certificates" && <CertificateIssuancePage apps={apps} issueCertificate={issueCertificate} lastCertificate={lastCertificate} />}
      {page === "map" && <LiveParcelMap apps={apps} openDetails={openDetails} />}
      {page === "analytics" && <AnalyticsDashboard />}
    </>
  );
}

function StaffDashboard({ kpis, apps, setPage }) {
  return (
    <>
      <div className="applicant-metrics">
        {dashMetric("Total Pending", kpis?.pending ?? 0, "orange")}
        {dashMetric("Legal Review", apps.filter((a) => a.status === "legal_review").length, "purple")}
        {dashMetric("Missing Docs", apps.filter((a) => a.status === "missing_documents").length, "red")}
        {dashMetric("Under Objection", kpis?.under_objection ?? 0, "red")}
        {dashMetric("Rejected", kpis?.rejected ?? 0, "red")}
        {dashMetric("Approved", kpis?.approved ?? 0, "green")}
      </div>
      <section className="panel">
        <div className="toolbar">
          <button className="btn" onClick={() => setPage("applications")}>View Applications</button>
          <button className="btn secondary" onClick={() => setPage("registrar")}>Legal Review</button>
          <button className="btn secondary" onClick={() => setPage("applications")}>Missing Documents</button>
          <button className="btn secondary" onClick={() => setPage("applications")}>Under Objection</button>
        </div>
      </section>
    </>
  );
}

function ApplicationManagementTable({ apps, filters, setFilters, reload, openDetails }) {
  const update = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  return (
    <section className="app-table-panel">
      <div className="panel-head"><h2>Application Management</h2><button className="btn secondary" onClick={reload}>Refresh</button></div>
      <div className="form-grid compact">
        <label>Status<input value={filters.status} onChange={(e) => update("status", e.target.value)} placeholder="submitted" /></label>
        <label>Type<input value={filters.type} onChange={(e) => update("type", e.target.value)} placeholder="ownership_transfer" /></label>
        <label>Zone<input value={filters.zone} onChange={(e) => update("zone", e.target.value)} placeholder="ZONE-RM-01" /></label>
        <label>Applicant<input value={filters.applicant} onChange={(e) => update("applicant", e.target.value)} placeholder="name" /></label>
        <label>Parcel<input value={filters.parcel} onChange={(e) => update("parcel", e.target.value)} placeholder="145" /></label>
        <div className="toolbar"><button className="btn secondary" onClick={() => setFilters({ status: "", type: "", zone: "", applicant: "", parcel: "" })}>Clear Filters</button></div>
      </div>
      <table className="clean-table">
        <thead><tr><th>ID</th><th>Applicant</th><th>Type</th><th>Status</th><th>Parcel</th><th>Zone</th><th>Submitted</th><th>Priority</th><th>Surveyor</th><th>Actions</th></tr></thead>
        <tbody>{apps.map((app) => <tr key={app._id}>
          <td>{app.application_id}</td><td>{app.applicant_ref?.full_name}</td><td>{app.type}</td><td><Status value={app.status} /></td><td>{app.parcel_ref?.parcel_number}</td><td>{app.parcel_ref?.zone_id}</td><td>{new Date(app.created_at).toLocaleDateString()}</td><td>{app.priority}</td><td>{app.assignment?.assigned_surveyor || "-"}</td>
          <td><button className="view-all" onClick={() => openDetails(app.application_id)}>Open Details</button></td>
        </tr>)}</tbody>
      </table>
    </section>
  );
}

function ApplicationDetailsPage({ selected, setPage, transition, addInternalNote, requestMissingDocuments, rejectSelected, holdSelected, assignSurveyor, note, setNote }) {
  if (!selected) return <section className="empty">Open an application from the table first.</section>;
  return (
    <section className="panel">
      <div className="panel-head"><h2>Application Details - {selected.application_id}</h2><button className="btn secondary" onClick={() => setPage("applications")}>Back to Table</button></div>
      <div className="grid">{metric("Status", selected.status)}{metric("Survey", selected.survey_status)}{metric("Certificate", selected.certificate_status)}{metric("Objections", selected.objections?.length || 0)}</div>
      <div className="details-grid">
        <div><h3>Applicant Details</h3><p>{selected.applicant_ref?.full_name}</p><p>{selected.applicant_ref?.applicant_id}</p></div>
        <div><h3>Parcel Details</h3><p>{selected.parcel_ref?.parcel_number} / {selected.parcel_ref?.zone_id}</p><p>{selected.parcel_ref?.block_number} - {selected.parcel_ref?.basin_number}</p></div>
        <div><h3>Workflow State</h3><Status value={selected.status} /><div className="timeline">{(selected.workflow?.allowed_next || []).map((s) => <span className="step" key={s}>{s}</span>)}</div></div>
      </div>
      <h3>Uploaded Documents</h3>
      <div className="document-list">{(selected.required_documents || []).map((doc) => <span className={`status ${doc.status}`} key={doc.document_type}>{doc.document_type}: {doc.status}</span>)}</div>
      <h3>Internal Notes</h3>
      <div className="form-grid"><label>Internal Note<input value={note} onChange={(e) => setNote(e.target.value)} /></label><button className="btn" onClick={addInternalNote}>Add Internal Note</button></div>
      <div className="toolbar">
        <button className="btn secondary" onClick={requestMissingDocuments}>Request Missing Documents</button>
        <button className="btn secondary" onClick={() => transition(selected.application_id, "pre_checked")}>Move to Pre-Checked</button>
        <button className="btn secondary" onClick={() => transition(selected.application_id, "survey_required")}>Send to Survey</button>
        <button className="btn secondary" onClick={() => assignSurveyor(selected.application_id)}>Auto Assign Surveyor</button>
        <button className="btn secondary" onClick={() => transition(selected.application_id, "legal_review")}>Send to Legal Review</button>
        <button className="btn" onClick={() => transition(selected.application_id, "approved")}>Approve Application</button>
        <button className="btn warn" onClick={rejectSelected}>Reject Application</button>
        <button className="btn secondary" onClick={holdSelected}>Put On Hold</button>
      </div>
    </section>
  );
}

function RegistrarReviewPage({ selected, apps, openDetails, reviewDocument, registrarDecision, transition, rejectSelected, requestMissingDocuments, decision, setDecision }) {
  const current = selected || apps.find((app) => app.status === "legal_review") || apps[0];
  return (
    <section className="panel">
      <div className="panel-head"><h2>Registrar Review</h2><select value={current?.application_id || ""} onChange={(e) => openDetails(e.target.value)}>{apps.map((app) => <option key={app.application_id}>{app.application_id}</option>)}</select></div>
      {!selected && <Notice>Open Details first to load full document and parcel information.</Notice>}
      {selected && <>
        <div className="details-grid"><div><h3>Parcel Info</h3><p>{selected.parcel_ref?.parcel_number} - {selected.parcel_ref?.zone_id}</p></div><div><h3>Objections</h3><p>{selected.objections?.length || 0}</p></div><div><h3>Survey Report</h3><p>{selected.survey_report ? "uploaded" : "pending"}</p></div></div>
        <div className="document-list">{(selected.required_documents || []).map((doc) => <span key={doc.document_type} className="status">{doc.document_type}: {doc.status} <button onClick={() => reviewDocument(doc.document_type, "verified")}>Accept</button> <button onClick={() => reviewDocument(doc.document_type, "rejected")}>Reject</button></span>)}</div>
        <label>Registrar Decision<input value={decision} onChange={(e) => setDecision(e.target.value)} /></label>
        <div className="toolbar"><button className="btn" onClick={registrarDecision}>Add Registrar Decision</button><button className="btn secondary" onClick={() => transition(selected.application_id, "approved")}>Send to Approval</button><button className="btn warn" onClick={rejectSelected}>Reject Application</button><button className="btn secondary" onClick={requestMissingDocuments}>Return for Missing Documents</button></div>
      </>}
    </section>
  );
}

function CertificateIssuancePage({ apps, issueCertificate, lastCertificate }) {
  const approved = apps.filter((app) => app.status === "approved" || app.status === "certificate_issued");
  return (
    <section className="app-table-panel">
      <div className="panel-head"><h2>Certificate Issuance</h2></div>
      <table className="clean-table"><thead><tr><th>Application</th><th>Applicant</th><th>Parcel</th><th>Certificate Type</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>{approved.map((app) => <tr key={app._id}><td>{app.application_id}</td><td>{app.applicant_ref?.full_name}</td><td>{app.parcel_ref?.parcel_number}</td><td>{app.type}</td><td><Status value={app.status} /></td><td><button className="btn" onClick={() => issueCertificate(app.application_id)}>Generate Certificate</button></td></tr>)}</tbody>
      </table>
      {lastCertificate && <div className="notice">certificate_id: {lastCertificate.certificate_id} | qr_code_url: {lastCertificate.qr_code_url} | status: {lastCertificate.status}</div>}
    </section>
  );
}

function LiveParcelMap({ apps = [], openDetails = null }) {
  const holderRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const [feed, setFeed] = useState(null);
  const [filters, setFilters] = useState({ zone: "", type: "", status: "", dispute: "" });

  async function load() {
    setFeed(await getParcels());
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!holderRef.current || mapRef.current) {
      return;
    }
    const map = L.map(holderRef.current).setView([31.9025, 35.2007], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "OpenStreetMap" }).addTo(map);
    mapRef.current = map;
  }, []);
  useEffect(() => {
    if (!mapRef.current || !feed) return;
    if (layerRef.current) layerRef.current.remove();
    const filtered = {
      ...feed,
      features: (feed.features || []).filter((feature) => {
        const props = feature.properties || {};
        if (filters.zone && props.zone_id !== filters.zone) return false;
        if (filters.type && props.type !== filters.type) return false;
        if (filters.status && props.status !== filters.status) return false;
        if (filters.dispute && props.dispute_state !== filters.dispute) return false;
        return true;
      }),
    };
    layerRef.current = L.geoJSON(filtered, {
      style: (feature) => ({ color: feature.properties?.status === "survey_required" ? "#f59e0b" : feature.properties?.status === "under_objection" ? "#e5484d" : "#0f62d6", weight: 2 }),
      onEachFeature: (feature, layer) => {
        const props = feature.properties || {};
        layer.bindPopup(`<b>${props.parcel_number}</b><br>${props.zone_id}<br>${props.status || ""}`);
        layer.on("click", () => props.application_id && openDetails && openDetails(props.application_id));
      },
    }).addTo(mapRef.current);
    if (layerRef.current.getBounds().isValid()) mapRef.current.fitBounds(layerRef.current.getBounds(), { padding: [24, 24] });
  }, [feed, filters, openDetails]);

  return (
    <section className="panel">
      <div className="panel-head"><h2>Live Parcel Map</h2><button className="btn secondary" onClick={load}>Filter</button></div>
      <div className="form-grid compact">
        <label>Zone<input value={filters.zone} onChange={(e) => setFilters({ ...filters, zone: e.target.value })} placeholder="ZONE-RM-01" /></label>
        <label>Application Type<input value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} placeholder="ownership_transfer" /></label>
        <label>Status<input value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} placeholder="survey_required" /></label>
        <label>Dispute State<input value={filters.dispute} onChange={(e) => setFilters({ ...filters, dispute: e.target.value })} placeholder="none" /></label>
        <div className="toolbar"><button className="btn secondary" onClick={() => setFilters({ zone: "", type: "", status: "", dispute: "" })}>Clear Filters</button><button className="btn secondary" onClick={() => setFilters({ ...filters, status: "submitted" })}>Show Pending</button><button className="btn secondary" onClick={() => setFilters({ ...filters, status: "survey_required" })}>Show Survey Required</button><button className="btn secondary" onClick={() => setFilters({ ...filters, dispute: "disputed" })}>Show Disputed Parcels</button></div>
      </div>
      <div ref={holderRef} className="leaflet-picker tall" />
    </section>
  );
}

function AnalyticsDashboard() {
  const [data, setData] = useState({ kpis: null, status: [], zone: [], processing: [], surveyors: [] });
  async function load() {
    const [kpis, status, zone, processing, surveyors] = await Promise.all([getKpis(), getByStatus(), getByZone(), getProcessingTime(), getSurveyors()]);
    setData({ kpis, status, zone, processing, surveyors });
  }
  useEffect(() => { load(); }, []);
  function exportCsv() {
    const rows = [["metric", "value"], ...Object.entries(data.kpis || {})];
    const csv = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lrmis-analytics.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="panel">
      <div className="panel-head"><h2>Analytics Dashboard</h2><div className="toolbar"><button className="btn" onClick={load}>Refresh Analytics</button><button className="btn secondary" onClick={exportCsv}>Export CSV</button><button className="btn secondary" onClick={() => window.print()}>Export PDF</button></div></div>
      <div className="applicant-metrics">
        {dashMetric("Total", data.kpis?.total_applications ?? 0, "blue")}
        {dashMetric("Pending", data.kpis?.pending ?? 0, "orange")}
        {dashMetric("Approved", data.kpis?.approved ?? 0, "green")}
        {dashMetric("Rejected", data.kpis?.rejected ?? 0, "red")}
        {dashMetric("Objections", data.kpis?.under_objection ?? 0, "purple")}
        {dashMetric("Certificates", data.kpis?.certificates_issued ?? 0, "sky")}
      </div>
      <div className="details-grid">
        <AnalyticsList title="Applications by Status" items={data.status} />
        <AnalyticsList title="Pending by Zone" items={data.zone} />
        <AnalyticsList title="Processing Time" items={data.processing.map((i) => ({ _id: i._id, count: Math.round(i.avg_processing_hours || 0) }))} />
      </div>
      <section className="app-table-panel"><h2>Surveyor Workload</h2><table className="clean-table"><thead><tr><th>Surveyor</th><th>Zones</th><th>Active Tasks</th><th>Task Count</th></tr></thead><tbody>{data.surveyors.map((s) => <tr key={s._id}><td>{s.name || s.staff_code}</td><td>{(s.zones || []).join(", ")}</td><td>{s.workload?.active_tasks || 0}</td><td>{s.task_count || 0}</td></tr>)}</tbody></table></section>
    </section>
  );
}

function AnalyticsList({ title, items }) {
  const max = Math.max(1, ...items.map((item) => item.count || 0));
  return <div><h3>{title}</h3><div className="bars">{items.map((item) => <div className="bar" key={item._id || "none"} style={{ "--w": `${((item.count || 0) / max) * 100}%` }}><span>{item._id || "none"}</span><span /><b>{item.count}</b></div>)}</div></div>;
}

function SurveyorPages() {
  const [staff, setStaff] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [page, setPage] = useState("tasks");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldNote, setFieldNote] = useState("Boundary checked with applicant present.");
  async function load() {
    try {
      const staffData = await getStaff(localStorage.getItem("linked_id"));
      const taskData = await getSurveyTasks();
      setStaff(staffData);
      setTasks(taskData.items || staffData.survey_tasks || []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
  }
  useEffect(() => { load(); }, []);

  async function milestone(task, value, extra = {}) {
    await patchJson(`/applications/${task.application_number || task.application_id}/survey-milestone`, { milestone: value, field_notes: extra.field_notes, scheduled_date: extra.scheduled_date, note: extra.note, actor: { role: "surveyor", id: localStorage.getItem("linked_id") } });
    setMessage(`Milestone updated to ${value}.`);
    await load();
  }
  async function report(task) {
    await postJson(`/applications/${task.application_number || task.application_id}/survey-report`, { report_type: "field_survey", file_name: "survey_report.pdf", file_url: "/uploads/survey_report.pdf", summary: "Boundary verified successfully.", findings: { boundary_matches: true }, attachments: [], actor: { role: "surveyor", id: localStorage.getItem("linked_id") } });
    setMessage("Survey report uploaded through protected API.");
    await load();
  }

  return (
    <>
      {error && <Notice>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      <div className="portal-tabs">{["tasks", "execution", "map"].map((tab) => <button className={page === tab ? "active" : ""} onClick={() => setPage(tab)} key={tab}>{tab}</button>)}</div>
      <div className="grid">{metric("Assigned Tasks", tasks.length)}{metric("Today Visits", tasks.filter((t) => t.status === "visit_scheduled").length)}{metric("In Progress", tasks.filter((t) => !["report_uploaded", "registrar_reviewed"].includes(t.status)).length)}{metric("Completed", tasks.filter((t) => ["report_uploaded", "registrar_reviewed"].includes(t.status)).length)}</div>
      {page === "tasks" && <SurveyTaskList tasks={tasks} setSelectedTask={setSelectedTask} setPage={setPage} load={load} />}
      {page === "execution" && <SurveyTaskExecution task={selectedTask || tasks[0]} fieldNote={fieldNote} setFieldNote={setFieldNote} milestone={milestone} report={report} setPage={setPage} />}
      {page === "map" && <LiveParcelMap />}
    </>
  );
}

function SurveyTaskList({ tasks, setSelectedTask, setPage, load }) {
  return (
    <section className="app-table-panel">
      <div className="panel-head"><h2>My Survey Tasks</h2><button className="btn secondary" onClick={load}>Refresh</button></div>
      <table className="clean-table"><thead><tr><th>Task ID</th><th>Application</th><th>Parcel</th><th>Zone</th><th>Priority</th><th>Scheduled Visit</th><th>Milestone</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{tasks.map((task) => <tr key={task._id}><td>{task.task_id}</td><td>{task.application_number || task.application_id}</td><td>{task.parcel_ref?.parcel_number}</td><td>{task.parcel_ref?.zone_id}</td><td>{task.priority}</td><td>{(task.milestones || []).find((m) => m.milestone === "visit_scheduled")?.scheduled_date || "-"}</td><td>{task.current_milestone || task.status}</td><td><Status value={task.status} /></td><td className="toolbar"><button className="view-all" onClick={() => { setSelectedTask(task); setPage("execution"); }}>Open Task</button><button className="view-all" onClick={() => setPage("map")}>View Parcel on Map</button></td></tr>)}</tbody>
      </table>
    </section>
  );
}

function SurveyTaskExecution({ task, fieldNote, setFieldNote, milestone, report, setPage }) {
  if (!task) return <section className="empty">No assigned survey tasks yet.</section>;
  return (
    <section className="panel">
      <div className="panel-head"><h2>Survey Task Execution - {task.task_id}</h2><button className="btn secondary" onClick={() => setPage("tasks")}>Back to Tasks</button></div>
      <div className="details-grid">
        <div><h3>Application Info</h3><p>{task.application_number || task.application_id}</p><p>Priority: {task.priority}</p></div>
        <div><h3>Parcel Info</h3><p>{task.parcel_ref?.parcel_number}</p><p>{task.parcel_ref?.zone_id}</p></div>
        <div><h3>Current Milestone</h3><Status value={task.current_milestone || task.status} /><p>Report: {task.report_uploaded ? "uploaded" : "pending"}</p></div>
      </div>
      <h3>Milestones</h3>
      <div className="timeline">{["assigned", "visit_scheduled", "arrived_on_site", "survey_started", "survey_completed", "report_uploaded", "registrar_reviewed"].map((step) => <span className={`step ${step === task.current_milestone ? "done" : ""}`} key={step}>{step}</span>)}</div>
      <label>Field Notes<input value={fieldNote} onChange={(e) => setFieldNote(e.target.value)} /></label>
      <div className="toolbar">
        <button className="btn secondary" onClick={() => milestone(task, "visit_scheduled", { scheduled_date: "2026-02-05", note: "Visit planned with applicant" })}>Mark Visit Scheduled</button>
        <button className="btn secondary" onClick={() => milestone(task, "arrived_on_site", { note: "Arrived on site" })}>Mark Arrived On Site</button>
        <button className="btn secondary" onClick={() => milestone(task, "survey_started", { note: "Survey started" })}>Mark Survey Started</button>
        <button className="btn secondary" onClick={() => milestone(task, "survey_completed", { field_notes: fieldNote, note: "Survey completed" })}>Mark Survey Completed</button>
        <button className="btn" onClick={() => report(task)}>Upload Survey Report</button>
        <button className="btn secondary" onClick={() => milestone(task, task.current_milestone || task.status, { field_notes: fieldNote })}>Add Field Notes</button>
      </div>
    </section>
  );
}

function DashboardCards({ apps }) {
  return <div className="applicant-metrics">
    {dashMetric("Total Applications", apps.length, "blue")}
    {dashMetric("Pending", apps.filter((a) => ["submitted", "pre_checked"].includes(a.status)).length, "orange")}
    {dashMetric("Approved", apps.filter((a) => ["approved", "certificate_issued", "closed"].includes(a.status)).length, "green")}
    {dashMetric("Certificates", apps.filter((a) => ["certificate_issued", "closed"].includes(a.status)).length, "purple")}
  </div>;
}

function ApplicationsTable({ apps, onTrack }) {
  return <table className="clean-table"><thead><tr><th>Application ID</th><th>Type</th><th>Parcel No.</th><th>Status</th><th>Next Step</th><th>Action</th></tr></thead>
    <tbody>{apps.map((app) => <tr key={app._id}><td>{app.application_id}</td><td>{app.type}</td><td>{app.parcel_ref?.parcel_number}</td><td><Status value={app.status} /></td><td>{nextStep(app.status)}</td><td><button className="view-all" onClick={() => onTrack(app.application_id)}>Track</button></td></tr>)}</tbody>
  </table>;
}

function TimelinePanel({ timeline }) {
  return <section className="panel"><h2>Track Application</h2><div className="timeline">{(timeline.event_stream || []).map((event, index) => <span className="step done" key={index}>{event.type}</span>)}</div></section>;
}

function Status({ value }) {
  return <span className={`status ${value}`}>{value}</span>;
}

function Notice({ children }) {
  return <div className="notice">{children}</div>;
}

function metric(label, value) {
  return <div className="card"><div className="card-label">{label}</div><div className="metric-row"><div className="metric">{value}</div><div className="metric-icon">{label.slice(0, 2)}</div></div></div>;
}

function dashMetric(label, value, color) {
  return <div className={`dash-card ${color}`}><div className="dash-icon">{label.split(" ").map((w) => w[0]).join("").slice(0, 2)}</div><div><small>{label}</small><strong>{value}</strong></div></div>;
}

function nextStep(status) {
  return {
    submitted: "Waiting for review",
    pre_checked: "Survey assignment",
    survey_required: "Survey visit",
    surveyed: "Legal review",
    legal_review: "Registrar decision",
    approved: "Certificate prep.",
    certificate_issued: "Closed",
  }[status] || "Review required";
}

createRoot(document.getElementById("root")).render(<App />);
