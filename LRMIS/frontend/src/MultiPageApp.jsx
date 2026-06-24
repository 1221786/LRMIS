import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import L from "leaflet";
import {
  api,
  getApplication,
  getApplications,
  getCertificates,
  getKpis,
  getLogs,
  getObjections,
  getParcels,
  getTimeline,
  patchJson,
  postJson,
} from "./api/client";

const workflowStates = ["submitted", "pre_checked", "survey_required", "surveyed", "legal_review", "approved", "certificate_issued", "closed"];
const appTypes = ["ownership_transfer", "first_registration", "parcel_subdivision", "parcel_merge", "boundary_correction", "certificate_request"];

function session() {
  return {
    role: localStorage.getItem("role") || "staff",
    fullName: localStorage.getItem("full_name") || "LRMIS User",
  };
}

function unwrapItems(result) {
  if (Array.isArray(result)) return result;
  return result?.items || [];
}

function statusTone(status) {
  if (["approved", "certificate_issued", "closed"].includes(status)) return "good";
  if (["rejected", "under_objection", "missing_documents"].includes(status)) return "bad";
  if (["survey_required", "surveyed", "legal_review"].includes(status)) return "warn";
  return "info";
}

export default function MultiPageApp() {
  return (
    <UiErrorBoundary>
      <MainLayout />
    </UiErrorBoundary>
  );
}

class UiErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mp-runtime-error">
          <h1>LRMIS screen recovered</h1>
          <p>{this.state.error.message}</p>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function MainLayout() {
  const user = session();
  return (
    <div className="mp-shell">
      <aside className="mp-sidebar">
        <div className="mp-brand">
          <div className="mp-logo">L</div>
          <div>
            <strong>LRMIS</strong>
            <span>Land Registration Management Information System</span>
          </div>
        </div>
        <nav className="mp-nav">
          <div className="mp-module-card">
            <div className="mp-module-icon">✦</div>
            <strong>STUDENT 1 MODULE</strong>
            <span>Land Application Management</span>
          </div>
          <NavLink to="/dashboard"><i>⌂</i><span>Dashboard</span></NavLink>
          <NavLink to="/applications"><i>◉</i><span>Applications</span><b>⌄</b></NavLink>
          <div className="mp-subnav">
            <NavLink to="/applications">All Application</NavLink>
            <NavLink to="/applications/new">New Application</NavLink>
            <NavLink to="/applications/track/LRMIS-2026-0001">Search Application</NavLink>
          </div>
          <NavLink to="/workflow"><i>◎</i><span>Workflow & Transitions</span></NavLink>
          <NavLink to="/map"><i>◇</i><span>Parcels (Map)</span></NavLink>
          <NavLink to="/documents"><i>▣</i><span>Documents</span></NavLink>
          <NavLink to="/certificates"><i>▤</i><span>Certificates</span></NavLink>
          <NavLink to="/logs"><i>◷</i><span>Audit Logs</span></NavLink>
          <NavLink to="/reports"><i>△</i><span>Reports</span></NavLink>
          <NavLink to="/objections"><i>!</i><span>Objections</span></NavLink>
          <NavLink to="/settings"><i>⚙</i><span>Settings</span><b>⌄</b></NavLink>
        </nav>
        <div className="mp-sidebar-user">
          <div className="mp-avatar">OH</div>
          <div><strong>Omar Hassan</strong><span>Registrar</span></div>
          <small>Online</small>
        </div>
      </aside>
      <main className="mp-main">
        <header className="mp-topbar">
          <div>
            <strong>{pageTitle()}</strong>
            <span>Workflow-driven geo-spatial land registration system</span>
          </div>
          <div className="mp-top-icons"><span>🔔</span><span>?</span></div>
          <div className="mp-user">
            <div className="mp-avatar">OH</div>
            <span>{user.role}</span>
            <strong>{user.fullName}</strong>
          </div>
        </header>
        <section className="mp-page">
          <Outlet />
        </section>
        <footer className="mp-footer">
          <span>Independent Application Creation</span>
          <span>Strict Workflow / State Machine</span>
          <span>Audit Logs & Performance Tracking</span>
          <span>GeoJSON Parcel Management</span>
          <span>Document Verification</span>
          <span>LRMIS v1.0</span>
        </footer>
      </main>
    </div>
  );
}

function pageTitle() {
  const path = window.location.pathname;
  if (path.includes("/applications/new")) return "Submit New Application";
  if (path.includes("/applications/") && path.includes("/confirmation")) return "Application Confirmation";
  if (path.includes("/applications/track")) return "Track Application";
  if (path.includes("/applications/")) return "Application Details";
  if (path.includes("/applications")) return "Applications";
  if (path.includes("/workflow")) return "Workflow & Transitions";
  if (path.includes("/documents")) return "Documents";
  if (path.includes("/map")) return "Live Parcel Map";
  if (path.includes("/certificates")) return "Certificates";
  if (path.includes("/reports")) return "Reports";
  if (path.includes("/logs")) return "Audit Logs";
  if (path.includes("/objections")) return "Objections";
  if (path.includes("/settings")) return "Settings";
  return "Dashboard";
}

export function DashboardPage() {
  const [kpis, setKpis] = useState(null);
  const [apps, setApps] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getKpis().then(setKpis).catch((err) => setError(err.response?.data?.detail || "Could not load KPIs"));
    getApplications({ limit: 6 }).then((result) => setApps(unwrapItems(result))).catch(() => setApps([]));
  }, []);

  const featured = apps[0] || {};
  const documents = featured.required_documents || [
    { document_type: "Ownership Deed", file_name: "uploaded on 2025-06-18", status: "verified" },
    { document_type: "ID Copy", file_name: "uploaded on 2025-06-18", status: "verified" },
    { document_type: "Contract", file_name: "uploaded on 2025-06-18", status: "pending_review" },
    { document_type: "Parcel Sketch", file_name: "uploaded on 2025-06-18", status: "verified" },
  ];
  const cards = [
    ["Total Applications", "1,246", "+12% from last month"],
    ["Pending / Submitted", "512", "+8% from last month"],
    ["Under Review", "248", "+9% from last month"],
    ["Approved", "346", "+10% from last month"],
    ["Certificates Issued", "186", "+7% from last month"],
    ["Under Objection / On Hold", "54", "-3% from last month"],
  ];

  return (
    <div className="mp-stack">
      {error && <div className="mp-alert bad">{error}</div>}
      <div className="mp-kpi-grid">
        {cards.map(([label, value, delta], index) => (
          <article className="mp-kpi" key={label}>
            <div className={`mp-kpi-icon tone-${index + 1}`}>{index + 1}</div>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{delta}</small>
          </article>
        ))}
      </div>
      <section className="mp-panel">
        <div className="mp-panel-title">
          <h2>Applications</h2>
          <Link to="/applications">View all</Link>
        </div>
        <ApplicationsTable apps={apps} compact />
      </section>
    </div>
  );

  return (
    <div className="mp-stack">
      {error && <div className="mp-alert bad">{error}</div>}
      <div className="mp-kpi-grid">
        {cards.map(([label, value, delta], index) => (
          <article className="mp-kpi" key={label}>
            <div className={`mp-kpi-icon tone-${index + 1}`}>{index + 1}</div>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{delta}</small>
          </article>
        ))}
      </div>
      <div className="mp-dashboard-grid">
        <section className="mp-panel">
          <div className="mp-panel-title">
            <h2>Applications</h2>
            <Link to="/applications">View all</Link>
          </div>
          <ApplicationsTable apps={apps} compact />
        </section>
        <aside className="mp-stack">
          <section className="mp-panel">
            <h2>Workflow Overview</h2>
            <WorkflowStrip current="certificate_issued" withCounts />
          </section>
          <section className="mp-panel">
            <h2>Quick Actions</h2>
            <QuickActions />
          </section>
        </aside>
      </div>
      <div className="mp-student-board">
        <section className="mp-panel">
          <h2><b>1.</b> Submit Land Application</h2>
          <ProgressDots active={1} />
          <div className="mp-mini-form-grid">
            <div>
              <label>Application Type<select value={featured.type || "ownership_transfer"} readOnly><option>Ownership Transfer</option></select></label>
              <h3>Applicant Information</h3>
              <label>Full Name<input readOnly value={featured.applicant_ref?.full_name || "Ahmad Khaled"} /></label>
              <label>National ID / Reg. No.<input readOnly value="2000-123456-7890" /></label>
              <label>Phone<input readOnly value="0791234567" /></label>
              <label>Email<input readOnly value="ahmad.khaled@email.com" /></label>
              <label>Applicant Type<select readOnly><option>Citizen</option></select></label>
              <Link className="mp-button primary" to="/applications/new">Next</Link>
            </div>
            <div>
              <h3>Parcel Information</h3>
              <div className="mp-two-cols">
                <label>Parcel No.<input readOnly value={featured.parcel_ref?.parcel_number || "145/12"} /></label>
                <label>Block No.<input readOnly value={featured.parcel_ref?.block_number || "12"} /></label>
                <label>Basin No.<input readOnly value={featured.parcel_ref?.basin_number || "3"} /></label>
                <label>Zone<input readOnly value={featured.parcel_ref?.zone_id || "RM-01"} /></label>
              </div>
              <GeoJsonMap geometry={featured.parcel?.geometry || { type: "Polygon", coordinates: [[[35.2001, 31.9021], [35.2051, 31.9021], [35.2051, 31.9061], [35.2001, 31.9061], [35.2001, 31.9021]]] }} />
            </div>
          </div>
        </section>
        <section className="mp-panel mp-confirm">
          <h2><b>2.</b> Application Confirmation</h2>
          <div className="mp-check">✓</div>
          <h3>Application Submitted Successfully!</h3>
          <strong>{featured.application_id || "LRMIS-2025-0001"}</strong>
          <dl>
            <dt>Current Status</dt><dd><span className="mp-badge info">{featured.status || "submitted"}</span></dd>
            <dt>Submitted At</dt><dd>{formatDate(featured.created_at) || "2025-06-18 10:30 AM"}</dd>
            <dt>Application Type</dt><dd>{featured.type || "Ownership Transfer"}</dd>
            <dt>Estimated Next Step</dt><dd>Pre-check by Registrar</dd>
          </dl>
          <div className="mp-actions center"><Link className="mp-button" to={`/applications/${featured.application_id || "LRMIS-2026-0001"}`}>View Application</Link><button className="primary">Download Receipt</button></div>
        </section>
        <section className="mp-panel">
          <h2><b>3.</b> Track Application</h2>
          <div className="mp-actions"><input readOnly value={featured.application_id || "LRMIS-2025-0001"} /><Link className="mp-button primary" to={`/applications/track/${featured.application_id || "LRMIS-2026-0001"}`}>Search</Link></div>
          <div className="mp-track-preview">
            <Timeline events={[
              { type: "submitted", at: featured.created_at, by: { role: "Applicant" } },
              { type: "pre_checked", at: featured.updated_at, by: { role: "Registrar" } },
              { type: "survey_required", at: featured.updated_at, by: { role: "Registrar" } },
              { type: "surveyed", at: null, by: { role: "Pending" } },
              { type: "legal_review", at: null, by: { role: "Pending" } },
            ]} />
            <div>
              <h3>Details</h3>
              <p><strong>Application Type</strong><br />Ownership Transfer</p>
              <p><strong>Parcel Number</strong><br />{featured.parcel_ref?.parcel_number || "145/12"}</p>
              <p><strong>Registrar Notes</strong><br />Your application is sent to survey planning.</p>
              <h3>Missing Documents</h3>
              <ul><li>Tax Clearance</li><li>Utility Bill</li></ul>
            </div>
          </div>
        </section>
        <section className="mp-panel">
          <h2><b>4.</b> Upload Additional Documents</h2>
          <label>Document Type<select><option>Select document type</option></select></label>
          <div className="mp-upload-box">Drag & drop file here<br />or<br />Browse Files</div>
          <Link className="mp-button primary" to="/documents">Upload Document</Link>
        </section>
        <section className="mp-panel">
          <h2><b>5.</b> Submit Objection</h2>
          <label>Objection Reason<select><option>Select reason</option><option>Boundary Dispute</option></select></label>
          <label>Details<textarea placeholder="Enter detailed explanation for the objection..." /></label>
          <div className="mp-upload-box">Drag & drop files here or Browse</div>
          <Link className="mp-button danger-link" to="/objections">Submit Objection</Link>
        </section>
        <section className="mp-panel">
          <h2>My Objections</h2>
          <table className="mp-table">
            <thead><tr><th>Objection ID</th><th>Application ID</th><th>Reason</th><th>Status</th><th>Submitted At</th><th>Actions</th></tr></thead>
            <tbody>
              <tr><td>OBJ-2025-0012</td><td>LRMIS-2025-0003</td><td>Boundary Dispute</td><td><span className="mp-badge warn">under_review</span></td><td>2025-06-17 04:30 PM</td><td>↗ 👁</td></tr>
              <tr><td>OBJ-2025-0011</td><td>LRMIS-2025-0002</td><td>Missing Documents</td><td><span className="mp-badge good">resolved</span></td><td>2025-06-12 10:15 AM</td><td>↗ 👁</td></tr>
              <tr><td>OBJ-2025-0009</td><td>LRMIS-2025-0007</td><td>Area Calculation</td><td><span className="mp-badge bad">rejected</span></td><td>2025-06-11 11:20 AM</td><td>↗ 👁</td></tr>
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

export function ApplicationsPage() {
  const [apps, setApps] = useState([]);
  const [filters, setFilters] = useState({ status: "", application_type: "", zone_id: "" });
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
    const result = await getApplications(params);
    setApps(unwrapItems(result));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mp-applications-screen">
      <section className="mp-panel mp-full-panel mp-applications-card">
        <h2>Applications</h2>
        <div className="mp-app-filters">
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">All Statuses</option>
            {workflowStates.concat(["missing_documents", "under_objection", "on_hold", "rejected"]).map((state) => <option key={state}>{state}</option>)}
          </select>
          <select value={filters.application_type} onChange={(e) => setFilters({ ...filters, application_type: e.target.value })}>
            <option value="">All Types</option>
            {appTypes.map((type) => <option key={type}>{type}</option>)}
          </select>
          <select value={filters.zone_id} onChange={(e) => setFilters({ ...filters, zone_id: e.target.value })}>
            <option value="">All Zones</option>
            <option>RM-01</option>
            <option>RM-02</option>
            <option>RM-03</option>
          </select>
          <button className="mp-date-filter">01/01/2025 - 30/06/2025</button>
          <input className="mp-app-search" placeholder="Search by ID, Applicant, Parcel..." />
          <button onClick={load} className="mp-filter-btn">{loading ? "Loading..." : "Filters"}</button>
          <button className="mp-download-btn">⇩</button>
        </div>
        <StudentApplicationsTable apps={apps} />
        <div className="mp-pagination">
          <span>Showing 1 to 6 of 1,246 applications</span>
          <div><button>1</button><button>2</button><button>3</button><button>4</button><button>5</button><button>...</button><button>206</button></div>
          <select><option>10 / page</option><option>20 / page</option></select>
        </div>
      </section>
    </div>
  );
}

function StudentApplicationsTable({ apps }) {
  const ids = apps.map((app) => app.application_id);
  const rows = [
    ["LRMIS-2025-0001", "Ownership Transfer", "Ahmad Khaled", "145/12", "RM-01", "submitted", "2025-06-16 10:30 AM"],
    ["LRMIS-2025-0002", "First Registration", "Nour Ahmad", "146/7", "RM-01", "pre_checked", "2025-06-18 11:20 AM"],
    ["LRMIS-2025-0003", "Parcel Subdivision", "Omar Saeed", "147/3-4", "RM-02", "survey_required", "2025-06-17 02:15 PM"],
    ["LRMIS-2025-0004", "Parcel Merge", "Sara Ali", "148/2-3", "RM-02", "surveyed", "2025-06-16 09:45 AM"],
    ["LRMIS-2025-0005", "Boundary Correction", "Hassan M.", "149/1", "RM-03", "legal_review", "2025-06-15 03:30 PM"],
    ["LRMIS-2025-0006", "Certificate Request", "Maha Yousef", "150/5", "RM-01", "approved", "2025-06-14 01:10 PM"],
  ];
  return (
    <table className="mp-student-app-table">
      <thead>
        <tr>
          <th>Application ID</th>
          <th>Type</th>
          <th>Applicant</th>
          <th>Parcel No.</th>
          <th>Zone</th>
          <th>Status</th>
          <th>Submitted At</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => {
          const routeId = ids[index] || "LRMIS-2026-0001";
          return (
            <tr key={row[0]}>
              <td>{row[0]}</td>
              <td>{row[1]}</td>
              <td>{row[2]}</td>
              <td>{row[3]}</td>
              <td>{row[4]}</td>
              <td><span className={`mp-badge ${statusTone(row[5])}`}>{row[5]}</span></td>
              <td>{row[6]}</td>
              <td className="mp-student-actions">
                <Link to={`/applications/${routeId}`}>↗</Link>
                <Link to={`/applications/track/${routeId}`}>◁</Link>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ApplicationsTable({ apps, compact = false }) {
  return (
    <div className={compact ? "" : "mp-panel"}>
      <table className="mp-table">
        <thead>
          <tr>
            <th>Application ID</th>
            <th>Applicant</th>
            <th>Type</th>
            <th>Parcel</th>
            <th>Zone</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {apps.map((app) => (
            <tr key={app._id || app.application_id}>
              <td>{app.application_id}</td>
              <td>{app.applicant_ref?.full_name}</td>
              <td>{app.type}</td>
              <td>{app.parcel_ref?.parcel_number}</td>
              <td>{app.parcel_ref?.zone_id}</td>
              <td><span className={`mp-badge ${statusTone(app.status)}`}>{app.status}</span></td>
              <td className="mp-row-actions">
                <Link to={`/applications/${app.application_id}`}>Open</Link>
                <Link to={`/applications/track/${app.application_id}`}>Track</Link>
              </td>
            </tr>
          ))}
          {!apps.length && <tr><td colSpan="7">No applications found.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function SubmitApplicationPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    type: "ownership_transfer",
    full_name: "Ahmad Al-Samman",
    national_id: `NID-${Date.now().toString().slice(-6)}`,
    phone: "0771234567",
    email: "applicant@example.com",
    parcel_number: "145",
    block_number: "12",
    basin_number: "3",
    zone_id: "ZONE-RM-01",
    area_sqm: 600.5,
  });
  const [error, setError] = useState("");

  function change(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    const payload = {
      type: form.type,
      priority: "normal",
      description: "Application submitted from SPA form",
      applicant: {
        full_name: form.full_name,
        national_id: form.national_id,
        type: "citizen",
        contacts: { phone: form.phone, email: form.email },
        address: { city: "Ramallah", line1: "Near Green Park" },
      },
      parcel: {
        parcel_number: form.parcel_number,
        block_number: form.block_number,
        basin_number: form.basin_number,
        zone_id: form.zone_id,
        area_sqm: Number(form.area_sqm),
        land_use: "residential",
        current_owner_refs: [],
        geometry: {
          type: "Polygon",
          coordinates: [[[35.2001, 31.9021], [35.2051, 31.9021], [35.2051, 31.9061], [35.2001, 31.9061], [35.2001, 31.9021]]],
        },
      },
      documents: [
        { document_type: "id_copy", file_name: "id.pdf", file_url: "/docs/id.pdf", status: "verified" },
        { document_type: "ownership_deed", file_name: "deed.pdf", file_url: "/docs/deed.pdf", status: "uploaded" },
        { document_type: "sale_contract", file_name: "sale.pdf", file_url: "/docs/sale.pdf", status: "uploaded" },
      ],
    };
    try {
      const created = await postJson("/applications/", payload, { "Idempotency-Key": `spa-${Date.now()}` });
      navigate(`/applications/${created.application_id}/confirmation`);
    } catch (err) {
      setError(err.response?.data?.detail || "Application could not be submitted");
    }
  }

  return (
    <form className="mp-student-form" onSubmit={submit}>
      {error && <div className="mp-alert bad">{error}</div>}
      <section className="mp-panel">
        <h2>1. Submit Land Application</h2>
        <div className="mp-form">
          <label>Application Type<select value={form.type} onChange={(e) => change("type", e.target.value)}>{appTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label>Full Name<input value={form.full_name} onChange={(e) => change("full_name", e.target.value)} /></label>
          <label>National ID<input value={form.national_id} onChange={(e) => change("national_id", e.target.value)} /></label>
          <label>Phone<input value={form.phone} onChange={(e) => change("phone", e.target.value)} /></label>
          <label>Email<input value={form.email} onChange={(e) => change("email", e.target.value)} /></label>
          <label>Applicant Type<select><option>Citizen</option><option>Lawyer</option><option>Company</option><option>Representative</option></select></label>
        </div>
      </section>
      <section className="mp-panel">
        <h2>2. Parcel Information</h2>
        <div className="mp-form">
          <label>Parcel Number<input value={form.parcel_number} onChange={(e) => change("parcel_number", e.target.value)} /></label>
          <label>Block Number<input value={form.block_number} onChange={(e) => change("block_number", e.target.value)} /></label>
          <label>Basin Number<input value={form.basin_number} onChange={(e) => change("basin_number", e.target.value)} /></label>
          <label>Zone<input value={form.zone_id} onChange={(e) => change("zone_id", e.target.value)} /></label>
          <label>Area SQM<input type="number" value={form.area_sqm} onChange={(e) => change("area_sqm", e.target.value)} /></label>
          <label>Owner References<input defaultValue="current-owner-ref-001" /></label>
        </div>
        <GeoJsonMap geometry={{ type: "Polygon", coordinates: [[[35.2001, 31.9021], [35.2051, 31.9021], [35.2051, 31.9061], [35.2001, 31.9061], [35.2001, 31.9021]]] }} />
      </section>
      <section className="mp-panel">
        <h2>3. Required Documents</h2>
        <div className="mp-upload-box">Drag & drop files here or register document metadata</div>
        <DocumentList documents={[
          { document_type: "id_copy", file_name: "id.pdf", status: "verified" },
          { document_type: "ownership_deed", file_name: "deed.pdf", status: "uploaded" },
          { document_type: "sale_contract", file_name: "sale.pdf", status: "pending_review" },
        ]} />
        <div className="mp-form-actions"><button className="primary">Submit Application</button></div>
      </section>
    </form>
  );
}

export function ApplicationConfirmationPage() {
  const { id } = useParams();
  const [app, setApp] = useState(null);
  useEffect(() => {
    getApplication(id).then(setApp).catch(() => setApp(null));
  }, [id]);
  if (!app) return <div className="mp-panel">Loading confirmation...</div>;
  return (
    <div className="mp-confirm-grid">
      <section className="mp-panel mp-confirm">
        <div className="mp-check">✓</div>
        <h2>Application Submitted Successfully!</h2>
        <strong>{app.application_id}</strong>
        <dl>
          <dt>Current Status</dt><dd><span className={`mp-badge ${statusTone(app.status)}`}>{app.status}</span></dd>
          <dt>Submitted At</dt><dd>{formatDate(app.created_at)}</dd>
          <dt>Required Next Step</dt><dd>{app.workflow?.allowed_next?.[0] || "Registrar review"}</dd>
          <dt>Parcel</dt><dd>{app.parcel_ref?.parcel_number} / {app.parcel_ref?.zone_id}</dd>
        </dl>
        <div className="mp-actions"><Link className="mp-button primary" to={`/applications/${app.application_id}`}>View Application</Link><Link className="mp-button" to={`/applications/track/${app.application_id}`}>Track Application</Link></div>
      </section>
      <section className="mp-panel">
        <h2>Parcel Location</h2>
        <GeoJsonMap geometry={app.parcel?.geometry} large />
      </section>
    </div>
  );
}

export function ApplicationDetailsPage() {
  const { id } = useParams();
  const [app, setApp] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    const [application, log] = await Promise.all([getApplication(id), getTimeline(id)]);
    setApp(application);
    setTimeline(log.event_stream || []);
  }

  useEffect(() => {
    load().catch((err) => setError(err.response?.data?.detail || "Could not load application"));
  }, [id]);

  async function requestTransition(target) {
    setError("");
    try {
      await patchJson(`/applications/${id}/transition`, { target_state: target, note: "Requested from multi-page SPA" });
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || "Workflow transition rejected by backend");
    }
  }

  async function issueCertificate() {
    setError("");
    try {
      await postJson(`/applications/${id}/certificate`, { issued_by: "registrar" });
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || "Certificate could not be issued");
    }
  }

  if (!app) return <div className="mp-panel">Loading application...</div>;

  return (
    <div className="mp-stack">
      {error && <div className="mp-alert bad">{error}</div>}
      <div className="mp-detail-grid">
        <section className="mp-panel">
          <h2>{app.application_id}</h2>
          <p>{app.applicant_ref?.full_name} - {app.type}</p>
          <span className={`mp-badge ${statusTone(app.status)}`}>{app.status}</span>
          <WorkflowStrip current={app.status} />
          <div className="mp-transition-grid">
            {(app.workflow?.allowed_next || []).map((state) => <button key={state} onClick={() => requestTransition(state)}>{state}</button>)}
            {app.status === "approved" && <button className="primary" onClick={issueCertificate}>Issue Certificate</button>}
          </div>
        </section>
        <section className="mp-panel">
          <h2>Parcel GeoJSON</h2>
          <GeoJsonMap geometry={app.parcel?.geometry} />
        </section>
      </div>
      <div className="mp-detail-grid">
        <section className="mp-panel">
          <h2>Documents</h2>
          <DocumentList documents={app.required_documents || app.documents || []} />
        </section>
        <section className="mp-panel">
          <h2>Audit Trail</h2>
          <Timeline events={timeline} />
        </section>
      </div>
    </div>
  );
}

export function TrackApplicationPage() {
  const { id } = useParams();
  const [applicationId, setApplicationId] = useState(id || "");
  const [app, setApp] = useState(null);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");

  async function search() {
    setError("");
    try {
      const [application, log] = await Promise.all([getApplication(applicationId), getTimeline(applicationId)]);
      setApp(application);
      setEvents(log.event_stream || []);
    } catch (err) {
      setError(err.response?.data?.detail || "Application timeline not found");
    }
  }

  useEffect(() => {
    if (id) search();
  }, [id]);

  return (
    <div className="mp-stack">
      <div className="mp-actions">
        <input value={applicationId} onChange={(e) => setApplicationId(e.target.value)} placeholder="LRMIS-2026-0001" />
        <button onClick={search}>Search Timeline</button>
      </div>
      {error && <div className="mp-alert bad">{error}</div>}
      <div className="mp-track-grid">
        <section className="mp-panel"><Timeline events={events} /></section>
        <aside className="mp-panel">
          <h2>Details</h2>
          {app ? (
            <>
              <p><strong>Current Status:</strong> <span className={`mp-badge ${statusTone(app.status)}`}>{app.status}</span></p>
              <p><strong>Survey Status:</strong> {app.survey_status}</p>
              <p><strong>Registrar Notes:</strong> {(app.visible_registrar_notes || []).map((note) => note.note).join(", ") || "No visible notes"}</p>
              <h2>Missing Documents</h2>
              <DocumentList documents={(app.required_documents || []).filter((doc) => doc.status === "missing")} />
              <Link className="mp-button primary" to="/documents">Upload Missing Documents</Link>
            </>
          ) : <p>Search an application to view details.</p>}
        </aside>
      </div>
    </div>
  );
}

export function DocumentsPage() {
  const [apps, setApps] = useState([]);
  const [selected, setSelected] = useState("");
  const [doc, setDoc] = useState({ document_type: "ownership_deed", file_name: "", file_url: "" });
  const [selectedFile, setSelectedFile] = useState(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    getApplications({ limit: 50 }).then((result) => {
      const items = unwrapItems(result);
      setApps(items);
      setSelected(items[0]?.application_id || "");
    }).catch(() => setApps([]));
  }, []);
  async function upload(event) {
    event.preventDefault();
    setMessage("");
    const fileName = selectedFile?.name || doc.file_name;
    if (!fileName) {
      setMessage("Please choose a file from your computer first.");
      return;
    }
    await postJson(`/applications/${selected}/documents`, {
      ...doc,
      file_name: fileName,
      file_url: `/local-upload/${fileName}`,
      status: "pending_review",
    });
    setMessage(`Document selected from computer and registered: ${fileName}`);
  }
  const current = apps.find((item) => item.application_id === selected);
  return (
    <div className="mp-doc-grid">
      <form className="mp-panel" onSubmit={upload}>
        <h2>Upload Additional Documents</h2>
        {message && <div className="mp-alert good">{message}</div>}
        <label>Application<select value={selected} onChange={(e) => setSelected(e.target.value)}>{apps.map((app) => <option key={app.application_id}>{app.application_id}</option>)}</select></label>
        <label>Document Type<select value={doc.document_type} onChange={(e) => setDoc({ ...doc, document_type: e.target.value })}><option>ownership_deed</option><option>id_copy</option><option>sale_contract</option><option>parcel_map</option><option>survey_report</option></select></label>
        <label className="mp-file-picker">
          Choose File From Computer
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              setSelectedFile(file);
              if (file) setDoc({ ...doc, file_name: file.name, file_url: `/local-upload/${file.name}` });
            }}
          />
          <span>{selectedFile ? selectedFile.name : "No file selected"}</span>
        </label>
        <div className="mp-upload-box">
          {selectedFile ? (
            <>
              Selected file<br />
              <strong>{selectedFile.name}</strong>
              <small>{Math.round(selectedFile.size / 1024)} KB</small>
            </>
          ) : (
            <>Click Choose File to select from your computer</>
          )}
        </div>
        <button className="primary">Upload Document</button>
      </form>
      <section className="mp-panel">
        <h2>Document Review Status</h2>
        <DocumentList documents={current?.required_documents || []} />
      </section>
    </div>
  );
}

export function MapPage() {
  const [features, setFeatures] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getParcels()
      .then((data) => setFeatures(data.features || []))
      .catch((err) => setError(err.response?.data?.detail || "Could not load GeoJSON parcels"));
  }, []);

  return (
    <div className="mp-stack">
      {error && <div className="mp-alert bad">{error}</div>}
      <div className="mp-map-layout">
        <section className="mp-panel">
          <h2>Parcels (Map)</h2>
          <GeoJsonMap featureCollection={{ type: "FeatureCollection", features }} large />
        </section>
        <aside className="mp-panel">
          <h2>Parcel Feed</h2>
          <table className="mp-table">
            <tbody>{features.map((feature, index) => <tr key={index}><td>{feature.properties?.parcel_code}</td><td>{feature.properties?.zone_id}</td><td>{feature.properties?.status}</td></tr>)}</tbody>
          </table>
        </aside>
      </div>
    </div>
  );
}

export function CertificatesPage() {
  const [certificates, setCertificates] = useState([]);
  useEffect(() => {
    getCertificates().then((data) => setCertificates(unwrapItems(data))).catch(() => setCertificates([]));
  }, []);
  return (
    <div className="mp-dashboard-grid">
      <section className="mp-panel">
        <h2>Certificates</h2>
        <table className="mp-table">
          <thead><tr><th>Certificate</th><th>Application</th><th>Status</th><th>Issued At</th><th>Verify</th></tr></thead>
          <tbody>
            {certificates.map((cert) => <tr key={cert._id}><td>{cert.certificate_id}</td><td>{cert.application_number}</td><td>{cert.status}</td><td>{formatDate(cert.issued_at)}</td><td>{cert.qr_code_url}</td></tr>)}
            {!certificates.length && <tr><td colSpan="5">No certificates issued yet.</td></tr>}
          </tbody>
        </table>
      </section>
      <aside className="mp-panel mp-certificate-preview">
        <h2>Certificate Preview</h2>
        <div className="mp-paper">
          <strong>Land Registration Certificate</strong>
          <p>Official certificate metadata is generated only after approved workflow state.</p>
          <span>CERT-2026-0001</span>
        </div>
      </aside>
    </div>
  );
}

export function LogsPage() {
  const [logs, setLogs] = useState([]);
  useEffect(() => {
    getLogs().then((data) => setLogs(unwrapItems(data))).catch(() => setLogs([]));
  }, []);
  const events = logs.flatMap((log) => (log.event_stream || []).map((event) => ({ ...event, application_id: log.application_id })));
  return (
    <section className="mp-panel mp-full-panel">
      <h2>Audit Logs</h2>
      <table className="mp-table">
        <thead><tr><th>Application</th><th>Event</th><th>Actor</th><th>Date</th></tr></thead>
        <tbody>
          {events.map((event, index) => <tr key={index}><td>{event.application_id}</td><td>{event.type}</td><td>{event.by?.role}</td><td>{formatDate(event.at)}</td></tr>)}
          {!events.length && <tr><td colSpan="4">No audit logs yet.</td></tr>}
        </tbody>
      </table>
    </section>
  );
}

export function ObjectionsPage() {
  const [objections, setObjections] = useState([]);
  const [apps, setApps] = useState([]);
  const [form, setForm] = useState({ application_id: "", reason: "Boundary dispute", details: "Parcel boundary overlaps with neighboring parcel." });
  useEffect(() => {
    getObjections().then((data) => setObjections(unwrapItems(data))).catch(() => setObjections([]));
    getApplications({ limit: 50 }).then((data) => {
      const items = unwrapItems(data);
      setApps(items);
      setForm((current) => ({ ...current, application_id: items[0]?.application_id || "" }));
    }).catch(() => setApps([]));
  }, []);
  async function submitObjection(event) {
    event.preventDefault();
    await postJson(`/applications/${form.application_id}/objections`, {
      reason: `${form.reason}: ${form.details}`,
      submitted_by: { role: "applicant", id: "portal-user" },
      supporting_documents: [{ file_name: "objection-evidence.pdf", file_url: "/docs/objection-evidence.pdf" }],
    });
    const data = await getObjections();
    setObjections(unwrapItems(data));
  }
  return (
    <div className="mp-doc-grid">
      <form className="mp-panel" onSubmit={submitObjection}>
        <h2>Submit Objection</h2>
        <label>Application<select value={form.application_id} onChange={(e) => setForm({ ...form, application_id: e.target.value })}>{apps.map((app) => <option key={app.application_id}>{app.application_id}</option>)}</select></label>
        <label>Objection Reason<select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}><option>Boundary dispute</option><option>Missing documents</option><option>Area calculation</option><option>Ownership conflict</option></select></label>
        <label>Details<textarea value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} /></label>
        <div className="mp-upload-box">Attach supporting documents</div>
        <button className="danger">Submit Objection</button>
      </form>
      <section className="mp-panel">
        <h2>My Objections</h2>
        <table className="mp-table">
          <thead><tr><th>Objection ID</th><th>Application</th><th>Reason</th><th>Status</th><th>Created</th></tr></thead>
          <tbody>
            {objections.map((obj) => <tr key={obj._id}><td>{obj.objection_id}</td><td>{obj.application_id}</td><td>{obj.reason}</td><td>{obj.status}</td><td>{formatDate(obj.created_at)}</td></tr>)}
            {!objections.length && <tr><td colSpan="5">No objections submitted.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export function WorkflowPage() {
  return (
    <div className="mp-workflow-page">
      <section className="mp-panel">
        <h2>Workflow Overview <small>(All Applications)</small></h2>
        <WorkflowStrip current="certificate_issued" withCounts />
      </section>
      <section className="mp-panel">
        <h2>Quick Actions</h2>
        <QuickActions />
      </section>
    </div>
  );
}

export function ReportsPage() {
  const [kpis, setKpis] = useState(null);
  const [logs, setLogs] = useState([]);
  useEffect(() => {
    getKpis().then(setKpis);
    getLogs().then((data) => setLogs(unwrapItems(data)));
  }, []);
  return (
    <div className="mp-stack">
      <div className="mp-kpi-grid">
        <article className="mp-kpi"><span>Total Applications</span><strong>{kpis?.total_applications ?? 0}</strong></article>
        <article className="mp-kpi"><span>Approved</span><strong>{kpis?.approved ?? 0}</strong></article>
        <article className="mp-kpi"><span>Certificates</span><strong>{kpis?.certificates_issued ?? 0}</strong></article>
        <article className="mp-kpi"><span>Audit Streams</span><strong>{logs.length}</strong></article>
      </div>
      <section className="mp-panel">
        <h2>Analytics Readiness</h2>
        <p>Reports are generated from MongoDB aggregations and performance_logs for workflow transparency.</p>
        <div className="mp-report-grid">
          <div><strong>Workflow Coverage</strong><span>State machine validation enabled</span></div>
          <div><strong>GeoJSON Ready</strong><span>Parcels rendered from MongoDB geometry</span></div>
          <div><strong>Audit Trail</strong><span>Events written to performance_logs</span></div>
        </div>
      </section>
    </div>
  );
}

export function SettingsPage() {
  return (
    <div className="mp-settings-grid">
      <section className="mp-panel">
        <h2>Workflow State Machine</h2>
        <WorkflowStrip current="submitted" />
      </section>
      <section className="mp-panel">
        <h2>MongoDB Collections</h2>
        <div className="mp-collection-grid">
          {["land_applications", "applicants", "parcels", "staff_members", "survey_tasks", "survey_reports", "certificates", "performance_logs"].map((name) => <span key={name}>{name}</span>)}
        </div>
      </section>
      <section className="mp-panel">
        <h2>Architecture Rules</h2>
        <p>Sidebar is navigation only. Dashboard contains KPIs only. Status changes are requested through backend workflow endpoints and validated server-side.</p>
      </section>
    </div>
  );
}

function WorkflowStrip({ current, withCounts = false }) {
  const currentIndex = workflowStates.indexOf(current);
  const counts = [512, 248, 132, 166, 96, 346, 106, 76];
  const labels = {
    submitted: "submitted",
    pre_checked: "pre_checked",
    survey_required: "survey_required",
    surveyed: "surveyed",
    legal_review: "legal_review",
    approved: "approved",
    certificate_issued: "certificate_issued",
    closed: "closed",
  };
  return (
    <div className="mp-workflow">
      {workflowStates.map((state, index) => (
        <span className={`${index <= currentIndex ? "active" : ""} wf-${index + 1}`} key={state}>
          <b>{index + 1}</b>
          <em>{labels[state]}</em>
          {withCounts && <small>{counts[index]}</small>}
        </span>
      ))}
    </div>
  );
}

function QuickActions() {
  const actions = [
    { to: "/applications/new", icon: "♙", tone: "green", title: "New Application", subtitle: "Create a new land registration application" },
    { to: "/workflow", icon: "↻", tone: "green", title: "Workflow Transitions", subtitle: "Review and update application states" },
    { to: "/documents", icon: "▣", tone: "yellow", title: "Missing Documents", subtitle: "Applications with missing documents", badge: 23 },
    { to: "/objections", icon: "⚠", tone: "red", title: "Under Objection", subtitle: "Applications under objection", badge: 12 },
    { to: "/certificates", icon: "◎", tone: "blue", title: "Generate Certificate", subtitle: "Generate certificate for approved applications" },
    { to: "/logs", icon: "☷", tone: "gray", title: "View Audit Logs", subtitle: "View system and user activity logs" },
  ];
  return (
    <div className="mp-quick-actions">
      {actions.map((action) => (
        <Link to={action.to} key={action.title}>
          <i className={`qa-icon ${action.tone}`}>{action.icon}</i>
          <strong>{action.title}<span>{action.subtitle}</span></strong>
          {action.badge && <mark>{action.badge}</mark>}
          <b>›</b>
        </Link>
      ))}
    </div>
  );
}

function ProgressDots({ active }) {
  return (
    <div className="mp-progress-dots">
      {["Application Info", "Parcel Info", "Documents", "Review"].map((label, index) => (
        <span className={index <= active ? "active" : ""} key={label}><b>{index + 1}</b><small>{label}</small></span>
      ))}
    </div>
  );
}

function DocumentList({ documents }) {
  return (
    <table className="mp-table">
      <tbody>
        {documents.map((doc) => <tr key={doc.document_type}><td>{doc.document_type}</td><td>{doc.file_name || "not uploaded"}</td><td><span className={`mp-badge ${doc.status === "missing" ? "bad" : "good"}`}>{doc.status}</span></td></tr>)}
      </tbody>
    </table>
  );
}

function Timeline({ events }) {
  return (
    <div className="mp-timeline">
      {events.map((event, index) => <div key={index}><strong>{event.type}</strong><span>{formatDate(event.at)} - {event.by?.role || "system"}</span></div>)}
      {!events.length && <p>No timeline events yet.</p>}
    </div>
  );
}

function GeoJsonMap({ geometry, featureCollection, large = false }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const layerRef = useRef(null);
  const data = useMemo(() => {
    if (featureCollection) return featureCollection;
    if (!geometry) return { type: "FeatureCollection", features: [] };
    return { type: "FeatureCollection", features: [{ type: "Feature", geometry, properties: {} }] };
  }, [JSON.stringify(geometry || featureCollection || {})]);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current, { scrollWheelZoom: false }).setView([31.904, 35.203], 14);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "OpenStreetMap" }).addTo(mapRef.current);
    }
    const map = mapRef.current;
    if (layerRef.current) {
      layerRef.current.removeFrom(map);
      layerRef.current = null;
    }
    layerRef.current = L.geoJSON(data, {
      style: (feature) => ({
        color: feature?.properties?.status === "under_objection" ? "#ef4444" : "#2563eb",
        weight: 2,
        fillColor: feature?.properties?.status === "certificate_issued" ? "#22c55e" : "#60a5fa",
        fillOpacity: 0.35,
      }),
    }).addTo(map);
    if (layerRef.current.getBounds().isValid()) map.fitBounds(layerRef.current.getBounds(), { padding: [20, 20] });
    setTimeout(() => map.invalidateSize(), 0);
    return undefined;
  }, [data]);

  useEffect(() => () => {
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      layerRef.current = null;
    }
  }, []);

  return <div ref={containerRef} className={large ? "mp-map large" : "mp-map"} />;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}
