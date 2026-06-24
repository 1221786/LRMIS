import React, { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import {
  api,
  getApplicant,
  getApplicantApplications,
  getApplications,
  getCertificates,
  getNotifications,
  getObjections,
  getTimeline,
  patchJson,
  postJson,
} from "./api/client";

const statuses = ["submitted", "pre_checked", "survey_required", "surveyed", "legal_review", "approved", "certificate_issued", "closed"];

function userSession() {
  return {
    linkedId: localStorage.getItem("linked_id"),
    role: localStorage.getItem("role") || "applicant",
    name: localStorage.getItem("full_name") || "Amina Khaled",
  };
}

function itemsOf(data) {
  return Array.isArray(data) ? data : data?.items || [];
}

function badgeTone(status) {
  if (["approved", "surveyed", "verified", "resolved", "generated"].includes(status)) return "good";
  if (["pre_checked", "survey_required", "pending", "under_review"].includes(status)) return "warn";
  if (["rejected", "under_objection", "missing"].includes(status)) return "bad";
  return "info";
}

export default function Student2App() {
  return (
    <div className="s2-shell">
      <aside className="s2-sidebar">
        <div className="s2-brand">
          <div className="s2-logo">LR</div>
          <div><strong>LRMIS</strong><span>Land Registration Management Information System</span></div>
        </div>
        <nav className="s2-nav">
          <NavLink to="/student2/dashboard"><i>⌂</i>Dashboard</NavLink>
          <NavLink to="/student2/profile"><i>♙</i>My Profile</NavLink>
          <NavLink to="/student2/applications"><i>▤</i>My Applications</NavLink>
          <NavLink to="/student2/applications/new"><i>＋</i>New Application</NavLink>
          <NavLink to="/student2/documents"><i>⇧</i>Upload Documents</NavLink>
          <NavLink to="/student2/comments"><i>✉</i>Comments</NavLink>
          <NavLink to="/student2/objections"><i>!</i>Objections</NavLink>
          <NavLink to="/student2/notifications"><i>●</i>Notifications</NavLink>
          <NavLink to="/student2/staff"><i>▦</i>Registrar Console</NavLink>
          <NavLink to="/student2/review"><i>✓</i>Registrar Review</NavLink>
          <NavLink to="/student2/certificates"><i>▣</i>Certificates</NavLink>
          <NavLink to="/student2/settings"><i>⚙</i>Settings</NavLink>
        </nav>
        <div className="s2-help">
          <strong>Need Help?</strong>
          <span>support@lrmis.gov.jo</span>
          <span>+960 6 500 1234</span>
        </div>
      </aside>
      <main className="s2-main">
        <Topbar />
        <section className="s2-page">
          <Outlet />
        </section>
      </main>
    </div>
  );
}

function Topbar() {
  const session = userSession();
  return (
    <header className="s2-topbar">
      <div>
        <h1>{window.location.pathname.includes("/staff") ? "Registrar & Staff Console" : "Student 2 - Applicant Portal"}</h1>
        <p>Submit Applications • Track Status • Upload Documents • Communicate</p>
      </div>
      <div className="s2-user"><span>EN</span><b>🔔</b><div className="s2-face">AK</div><strong>{session.name}<small>{session.role}</small></strong></div>
    </header>
  );
}

export function Student2Dashboard() {
  const session = userSession();
  const [apps, setApps] = useState([]);
  const [profile, setProfile] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    const load = async () => {
      const result = await getApplications({ limit: 5 });
      const allApps = itemsOf(result);
      setApps(allApps);
      if (session.linkedId) {
        getApplicant(session.linkedId).then(setProfile).catch(() => setProfile(null));
      }
      const first = allApps[0]?.application_id;
      if (first) getTimeline(first).then((data) => setTimeline(data.event_stream || [])).catch(() => setTimeline([]));
      getNotifications().then((data) => setNotes(itemsOf(data))).catch(() => setNotes([]));
    };
    load();
  }, []);

  const cards = [
    ["My Applications", 7, "Total applications", "blue"],
    ["In Progress", 3, "Applications", "yellow"],
    ["Approved", 2, "Applications", "cyan"],
    ["Under Review", 1, "Applications", "orange"],
    ["Need Comments", 1, "Need urgent action", "purple"],
    ["Under Objection", 0, "Applications", "red"],
  ];

  return (
    <div className="s2-stack">
      <div className="s2-kpis">{cards.map((card) => <KpiCard key={card[0]} card={card} />)}</div>
      <div className="s2-dashboard-grid">
        <ProfileSummary profile={profile} />
        <section className="s2-card span-2"><PanelTitle title="My Applications" link="/student2/applications" /><Student2ApplicationsTable apps={apps} compact /></section>
        <section className="s2-card"><PanelTitle title="Application Timeline" link={`/student2/track/${apps[0]?.application_id || "LRMIS-2026-0001"}`} /><Timeline events={timeline} /></section>
        <aside className="s2-card"><QuickActions /><NotificationsMini notes={notes} /></aside>
      </div>
    </div>
  );
}

function KpiCard({ card }) {
  const routeMap = {
    "My Applications": "/student2/applications",
    "In Progress": "/student2/applications",
    Approved: "/student2/certificates",
    "Under Review": "/student2/staff",
    "Need Comments": "/student2/comments",
    "Under Objection": "/student2/objections",
    "Pending Applications": "/student2/staff",
    "Pre-Checked": "/student2/staff",
    "Legal Review": "/student2/review",
    "Missing Documents": "/student2/documents",
  };
  return <article className={`s2-kpi ${card[3]}`}><i>{card[1]}</i><strong>{card[0]}</strong><b>{card[1]}</b><span>{card[2]}</span><Link to={routeMap[card[0]] || "/student2/applications"}>View</Link></article>;
}

function ProfileSummary({ profile }) {
  return (
    <section className="s2-card">
      <PanelTitle title="Profile Summary" link="/student2/profile" action="Edit Profile" />
      <div className="s2-profile-head"><div className="s2-photo">AK</div><h2>{profile?.full_name || "Amina Khaled Ahmad"}<span>{profile?.verification?.state || "verified"}</span></h2></div>
      <dl className="s2-profile-dl">
        <dt>National ID</dt><dd>{profile?.national_id || "2000-123456-7890"}</dd>
        <dt>Email</dt><dd>{profile?.contacts?.email || "amina.khaled@email.com"}</dd>
        <dt>Phone</dt><dd>{profile?.contacts?.phone || "+962 79 123 4567"}</dd>
        <dt>Address</dt><dd>{profile?.address?.line1 || "Amman - Marka - Street 15"}</dd>
        <dt>Language</dt><dd>{profile?.preferred_language || "English"}</dd>
        <dt>Notification</dt><dd>Email, SMS</dd>
        <dt>Privacy</dt><dd>Visible to officials only</dd>
      </dl>
    </section>
  );
}

function PanelTitle({ title, link, action = "View All" }) {
  return <div className="s2-panel-title"><h2>{title}</h2>{link && <Link to={link}>{action}</Link>}</div>;
}

function Student2ApplicationsTable({ apps, compact = false }) {
  const fallback = [
    { application_id: "LRMIS-2025-0001", type: "Ownership Transfer", parcel_ref: { parcel_number: "145/12", zone_id: "RM-01" }, status: "pre_checked", created_at: "2025-06-18" },
    { application_id: "LRMIS-2025-0002", type: "First Registration", parcel_ref: { parcel_number: "146/7", zone_id: "RM-01" }, status: "submitted", created_at: "2025-06-16" },
    { application_id: "LRMIS-2025-0003", type: "Parcel Subdivision", parcel_ref: { parcel_number: "147/3-4", zone_id: "RM-02" }, status: "survey_required", created_at: "2025-05-17" },
    { application_id: "LRMIS-2025-0004", type: "Parcel Merge", parcel_ref: { parcel_number: "148/2-3", zone_id: "RM-02" }, status: "surveyed", created_at: "2025-06-16" },
    { application_id: "LRMIS-2025-0005", type: "Boundary Correction", parcel_ref: { parcel_number: "149/1", zone_id: "RM-03" }, status: "legal_review", created_at: "2025-06-15" },
  ];
  const rows = apps.length ? apps : fallback;
  return (
    <table className="s2-table">
      <thead><tr><th>Application ID</th><th>Type</th><th>Parcel / Location</th><th>Status</th><th>Submitted At</th>{!compact && <th>Actions</th>}</tr></thead>
      <tbody>
        {rows.map((app) => {
          const parcel = app.parcel_ref || {};
          return (
            <tr key={app.application_id}>
              <td><Link to={`/student2/applications/${app.application_id}`}>{app.application_id}</Link></td>
              <td>{labelText(app.type)}</td>
              <td>{parcel.parcel_number || "-"} - {parcel.zone_id || parcel.zone || "-"}</td>
              <td><span className={`s2-badge ${badgeTone(app.status)}`}>{app.status}</span></td>
              <td>{formatDate(app.created_at || app.submitted_at)}</td>
              {!compact && <td><Link to={`/student2/track/${app.application_id}`}>View</Link></td>}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function QuickActions() {
  return (
    <div className="s2-quick">
      <Link to="/student2/applications/new">+ New Application</Link>
      <Link to="/student2/documents">▤ Upload Document</Link>
      <Link to="/student2/comments">✉ Add Comment / Response</Link>
      <Link to="/student2/objections">! Submit Objection</Link>
    </div>
  );
}

function NotificationsMini({ notes }) {
  const fallback = [
    ["Your application LRMIS-2025-0001 has been pre-checked.", "18 Jun 2025, 11:20 AM"],
    ["Please upload missing document: Tax Clearance", "17 Jun 2025, 02:15 PM"],
    ["Survey is required for your application.", "17 Jun 2025, 02:10 PM"],
  ];
  const rows = notes.length ? notes.slice(0, 3).map((n) => [n.message, n.created_at]) : fallback;
  return <div className="s2-notes"><PanelTitle title="Notifications" link="/student2/notifications" />{rows.map((n, i) => <div key={i}><b>{i + 1}</b><span>{n[0]}<small>{formatDate(n[1])}</small></span></div>)}</div>;
}

export function Student2ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    full_name: "Amina Khaled Ahmad",
    national_id: "2000-123456-7890",
    registration_number: "",
    email: "amina.khaled@email.com",
    phone: "+962 79 123 4567",
    address_line: "Amman - Marka - Street 15",
    city: "Amman",
    zone_id: "ZONE-AM-01",
    applicant_type: "citizen",
    verification_state: "verified",
    preferred_language: "English",
    notification_preferences: "Email, SMS",
    privacy_settings: "Visible to officials only",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const linked = userSession().linkedId;
  useEffect(() => {
    if (linked) {
      getApplicant(linked).then((data) => {
        setProfile(data);
        setForm({
          full_name: data.full_name || "Amina Khaled Ahmad",
          national_id: data.national_id || data.identity?.national_id || "2000-123456-7890",
          registration_number: data.registration_number || data.identity?.registration_number || "",
          email: data.contacts?.email || "amina.khaled@email.com",
          phone: data.contacts?.phone || "+962 79 123 4567",
          address_line: data.address?.line1 || "Amman - Marka - Street 15",
          city: data.address?.city || "Amman",
          zone_id: data.address?.zone_id || "ZONE-AM-01",
          applicant_type: data.type || "citizen",
          verification_state: data.verification?.state || data.verification_state || "verified",
          preferred_language: data.preferred_language || "English",
          notification_preferences: data.notification_preferences?.sms ? "Email, SMS" : "Email",
          privacy_settings: data.privacy_settings?.share_contact_with_staff ? "Visible to officials only" : "Private",
        });
      }).catch(() => {
        setProfile(null);
        setEditing(true);
        setError("Applicant not found. Fill the profile fields and press Save Profile to create it.");
      });
    }
  }, [linked]);
  async function save() {
    setError("");
    setMessage("Saving profile...");
    const payload = {
      full_name: form.full_name,
      national_id: form.national_id,
      registration_number: form.registration_number,
      type: form.applicant_type,
      applicant_type: form.applicant_type,
      contacts: { email: form.email, phone: form.phone },
      address: { line1: form.address_line, city: form.city, zone_id: form.zone_id },
      verification_state: form.verification_state,
      preferred_language: form.preferred_language,
      notification_preferences: {
        email: form.notification_preferences.includes("Email"),
        sms: form.notification_preferences.includes("SMS"),
        on_status_change: true,
        on_missing_documents: true,
        on_certificate_ready: true,
      },
      privacy_settings: {
        share_contact_with_staff: form.privacy_settings !== "Private",
        label: form.privacy_settings,
      },
    };
    try {
      if (!linked || !profile) {
        const created = await api("/applicants/", {
          method: "POST",
          data: payload,
        });
        setProfile(created);
        localStorage.setItem("linked_id", created._id);
        setEditing(false);
        setMessage("Applicant profile created.");
        return;
      }
      const updated = await api(`/applicants/${linked}`, {
        method: "PATCH",
        data: payload,
      });
      setProfile(updated);
      setEditing(false);
      setMessage("Profile settings updated.");
    } catch (err) {
      setMessage("");
      setError(err.response?.data?.detail || "Profile could not be saved. Check backend and login role.");
    }
  }
  return <div className="s2-two"><ProfileSummary profile={profile} /><section className="s2-card" id="profile-settings"><div className="s2-panel-title"><h2>Applicant Profile Settings</h2><button type="button" className="s2-edit-btn" onClick={() => { setEditing(true); setMessage("Edit mode enabled. Change fields then press Save Profile."); setError(""); }}>Edit Profile</button></div>{message && <div className="s2-success">{message}</div>}{error && <div className="s2-error">{error}</div>}<ProfileFields form={form} setForm={setForm} disabled={!editing} /><button type="button" onClick={save}>{editing ? "Save Profile" : "Save Profile"}</button></section></div>;
}

function ProfileFields({ form, setForm, disabled = false }) {
  const set = (field, value) => setForm({ ...form, [field]: value });
  return (
    <div className="s2-form">
      <label>Full Name<input disabled={disabled} value={form.full_name} onChange={(event) => set("full_name", event.target.value)} /></label>
      <label>National ID<input disabled={disabled} value={form.national_id} onChange={(event) => set("national_id", event.target.value)} /></label>
      <label>Registration Number<input disabled={disabled} value={form.registration_number} onChange={(event) => set("registration_number", event.target.value)} placeholder="Company or lawyer registration number" /></label>
      <label>Email<input disabled={disabled} value={form.email} onChange={(event) => set("email", event.target.value)} /></label>
      <label>Phone<input disabled={disabled} value={form.phone} onChange={(event) => set("phone", event.target.value)} /></label>
      <label>Address<input disabled={disabled} value={form.address_line} onChange={(event) => set("address_line", event.target.value)} /></label>
      <label>City<input disabled={disabled} value={form.city} onChange={(event) => set("city", event.target.value)} /></label>
      <label>Zone ID<input disabled={disabled} value={form.zone_id} onChange={(event) => set("zone_id", event.target.value)} /></label>
      <label>Applicant Type<select disabled={disabled} value={form.applicant_type} onChange={(event) => set("applicant_type", event.target.value)}><option>citizen</option><option>lawyer</option><option>company</option><option>surveyor</option><option>authorized_representative</option></select></label>
      <label>Verification State<select disabled={disabled} value={form.verification_state} onChange={(event) => set("verification_state", event.target.value)}><option>unverified</option><option>verified</option><option>suspended</option></select></label>
      <label>Preferred Language<select disabled={disabled} value={form.preferred_language} onChange={(event) => set("preferred_language", event.target.value)}><option>English</option><option>Arabic</option></select></label>
      <label>Notification Preferences<select disabled={disabled} value={form.notification_preferences} onChange={(event) => set("notification_preferences", event.target.value)}><option>Email</option><option>SMS</option><option>Email, SMS</option></select></label>
      <label>Privacy Settings<select disabled={disabled} value={form.privacy_settings} onChange={(event) => set("privacy_settings", event.target.value)}><option>Visible to officials only</option><option>Share contact with staff</option><option>Private</option></select></label>
    </div>
  );
}

export function Student2ApplicationsPage() {
  const [apps, setApps] = useState([]);
  const [filters, setFilters] = useState({ status: "", type: "", zone: "", search: "" });
  useEffect(() => { getApplications({ limit: 50 }).then((data) => setApps(itemsOf(data))).catch(() => setApps([])); }, []);
  const filtered = filterApplications(apps, filters);
  return <section className="s2-card s2-full"><PanelTitle title="My Applications" link="/student2/applications/new" action="New Application" /><Filters filters={filters} setFilters={setFilters} /><Student2ApplicationsTable apps={filtered} /></section>;
}

export function Student2ApplicationDetailsPage() {
  const { id } = useParams();
  const [app, setApp] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [note, setNote] = useState("Document is valid and complete.");
  const [message, setMessage] = useState("");

  async function load() {
    const application = await api(`/applications/${id}`);
    setApp(application);
    const log = await getTimeline(id).catch(() => ({ event_stream: [] }));
    setTimeline(log.event_stream || []);
  }

  useEffect(() => {
    load().catch(() => setMessage("Could not load application details."));
  }, [id]);

  async function transition(target) {
    try {
      await patchJson(`/applications/${id}/transition`, { target_state: target, note: `Student 2 registrar moved to ${target}` });
      setMessage(`Application moved to ${target}.`);
      await load();
    } catch (err) {
      setMessage(err.response?.data?.detail || "Workflow engine rejected this transition.");
    }
  }

  async function addNote() {
    await postJson(`/applications/${id}/notes`, { note, visible_to_applicant: true });
    setMessage("Registrar note saved and visible to applicant.");
    await load();
  }

  async function requestMissing() {
    await postJson(`/applications/${id}/request-missing-documents`, { document_types: ["ownership_deed"], note: "Please upload ownership deed." });
    setMessage("Missing documents requested.");
    await load();
  }

  async function reject() {
    await postJson(`/applications/${id}/reject`, { reason: "Legal or administrative requirement was not satisfied." });
    setMessage("Application rejected with reason.");
    await load();
  }

  if (!app) return <section className="s2-card s2-full"><h2>Application Details</h2>{message || "Loading..."}</section>;

  return (
    <div className="s2-details-grid">
      <section className="s2-card s2-detail-main">
        <PanelTitle title={`Application Details (${app.application_id})`} link="/student2/applications" action="Back to Applications" />
        {message && <div className="s2-success">{message}</div>}
        <div className="s2-detail-tabs"><span>Overview</span><span>Documents</span><span>Workflow</span><span>Notes</span><span>History</span></div>
        <div className="s2-detail-content">
          <div>
            <h3>Applicant Information</h3>
            <dl className="s2-profile-dl">
              <dt>Name</dt><dd>{app.applicant_ref?.full_name || "Amina Khaled Ahmad"}</dd>
              <dt>Applicant ID</dt><dd>{app.applicant_ref?.applicant_id}</dd>
              <dt>Type</dt><dd>{app.type}</dd>
              <dt>Status</dt><dd><span className={`s2-badge ${badgeTone(app.status)}`}>{app.status}</span></dd>
            </dl>
          </div>
          <div>
            <h3>Parcel Information</h3>
            <dl className="s2-profile-dl">
              <dt>Parcel No.</dt><dd>{app.parcel_ref?.parcel_number}</dd>
              <dt>Zone</dt><dd>{app.parcel_ref?.zone_id}</dd>
              <dt>Block</dt><dd>{app.parcel_ref?.block_number}</dd>
              <dt>Basin</dt><dd>{app.parcel_ref?.basin_number}</dd>
            </dl>
          </div>
          <div className="s2-mapbox">Parcel Map / GeoJSON</div>
        </div>
        <div className="s2-action-row">
          <button type="button" onClick={requestMissing}>Request Missing Documents</button>
          <button type="button" onClick={() => transition("pre_checked")}>Pre-check</button>
          <button type="button" onClick={() => transition("legal_review")}>Send Legal Review</button>
          <button type="button" onClick={() => transition("approved")}>Approve Application</button>
          <button type="button" className="danger" onClick={reject}>Reject Application</button>
        </div>
      </section>
      <aside className="s2-card">
        <h2>Workflow Progress</h2>
        <Timeline events={timeline} />
      </aside>
      <section className="s2-card">
        <h2>Uploaded Documents</h2>
        <DocumentList />
      </section>
      <section className="s2-card">
        <h2>Internal / Registrar Notes</h2>
        <label>Note<textarea value={note} onChange={(event) => setNote(event.target.value)} /></label>
        <button type="button" onClick={addNote}>Save Note</button>
      </section>
    </div>
  );
}

function Filters({ filters = {}, setFilters }) {
  const [message, setMessage] = useState("");
  const update = (field, value) => {
    if (setFilters) setFilters({ ...filters, [field]: value });
  };
  return <><div className="s2-filters"><select value={filters.status || ""} onChange={(event) => update("status", event.target.value)}><option value="">All Statuses</option><option>submitted</option><option>pre_checked</option><option>survey_required</option><option>surveyed</option><option>legal_review</option><option>approved</option><option>under_objection</option><option>missing_documents</option></select><select value={filters.type || ""} onChange={(event) => update("type", event.target.value)}><option value="">All Types</option><option>ownership_transfer</option><option>first_registration</option><option>parcel_subdivision</option><option>boundary_correction</option><option>certificate_request</option></select><select value={filters.zone || ""} onChange={(event) => update("zone", event.target.value)}><option value="">All Zones</option><option>RM-01</option><option>RM-02</option><option>RM-03</option><option>ZONE-RM-01</option><option>ZONE-RM-02</option><option>ZONE-RM-03</option></select><input value={filters.search || ""} onChange={(event) => update("search", event.target.value)} placeholder="Search by ID, Applicant, Parcel..." /><button type="button" onClick={() => setMessage("Filters applied to the table.")}>Filters</button></div>{message && <div className="s2-success">{message}</div>}</>;
}

export function Student2NewApplicationPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "Amina Khaled Ahmad", national_id: `S2-${Date.now().toString().slice(-6)}`, type: "ownership_transfer", parcel_number: "145/12", block_number: "12", basin_number: "3", zone_id: "RM-01" });
  async function submit(e) {
    e.preventDefault();
    const payload = {
      type: form.type,
      applicant: { full_name: form.full_name, national_id: form.national_id, contacts: { email: "amina.khaled@email.com", phone: "+962791234567" }, address: { line1: "Amman - Marka" }, type: "citizen" },
      parcel: { parcel_number: form.parcel_number, block_number: form.block_number, basin_number: form.basin_number, zone_id: form.zone_id, geometry: { type: "Polygon", coordinates: [[[35.2, 31.9], [35.21, 31.9], [35.21, 31.91], [35.2, 31.91], [35.2, 31.9]]] } },
      documents: [],
    };
    const created = await postJson("/applications/", payload, { "Idempotency-Key": `s2-${Date.now()}` });
    navigate(`/student2/track/${created.application_id}`);
  }
  return <form className="s2-card s2-new-form s2-full" onSubmit={submit}><h2>1. Submit Land Application</h2><Progress /><div className="s2-form-grid"><ApplicationInputs form={form} setForm={setForm} /><div className="s2-mapbox">Parcel Location Map</div></div><button>Next: Upload Documents</button></form>;
}

function ApplicationInputs({ form, setForm }) {
  const set = (field, value) => setForm({ ...form, [field]: value });
  return <div className="s2-form"><label>Application Type<select value={form.type} onChange={(e) => set("type", e.target.value)}><option>ownership_transfer</option><option>first_registration</option></select></label><label>Applicant Name<input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} /></label><label>Parcel No.<input value={form.parcel_number} onChange={(e) => set("parcel_number", e.target.value)} /></label><label>Block No.<input value={form.block_number} onChange={(e) => set("block_number", e.target.value)} /></label><label>Basin No.<input value={form.basin_number} onChange={(e) => set("basin_number", e.target.value)} /></label><label>Zone<input value={form.zone_id} onChange={(e) => set("zone_id", e.target.value)} /></label></div>;
}

function Progress() {
  return <div className="s2-progress"><span className="on">1 Applicant Info</span><span>2 Parcel Info</span><span>3 Documents</span><span>4 Review</span></div>;
}

export function Student2DocumentsPage() {
  const [apps, setApps] = useState([]);
  const [selected, setSelected] = useState("");
  const [documentType, setDocumentType] = useState("ownership_deed");
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  useEffect(() => { getApplications({ limit: 20 }).then((data) => { const rows = itemsOf(data); setApps(rows); setSelected(rows[0]?.application_id || ""); }); }, []);
  async function upload(e) {
    e.preventDefault();
    if (!selected) {
      setMessage("Choose an application first.");
      return;
    }
    await postJson(`/applications/${selected}/documents`, { document_type: documentType, file_name: file?.name || "document.pdf", file_url: `/local-upload/${file?.name || "document.pdf"}`, status: "pending_review" });
    setMessage(`Document uploaded: ${file?.name || "document.pdf"}`);
  }
  return <div className="s2-two s2-fill"><form className="s2-card" onSubmit={upload}><h2>2. Upload Additional Documents</h2>{message && <div className="s2-success">{message}</div>}<label>Application<select value={selected} onChange={(e) => setSelected(e.target.value)}>{apps.map((a) => <option key={a.application_id}>{a.application_id}</option>)}</select></label><label>Document Type<select value={documentType} onChange={(event) => setDocumentType(event.target.value)}><option>ownership_deed</option><option>id_copy</option><option>sale_contract</option><option>parcel_map</option><option>tax_clearance</option></select></label><label className="s2-drop">Drag & drop file here or click to browse<input type="file" onChange={(e) => setFile(e.target.files?.[0])} />{file && <b>{file.name}</b>}</label><button>Upload Document</button></form><section className="s2-card"><h2>Uploaded Documents</h2><DocumentList app={apps.find((item) => item.application_id === selected)} /></section></div>;
}

function DocumentList({ app }) {
  const docs = app?.required_documents?.length ? app.required_documents.map((doc) => [doc.document_type, doc.status, doc.uploaded_at]) : [["Ownership Deed", "verified", "2025-06-18"], ["ID Copy", "verified", "2025-06-18"], ["Contract", "pending", "2025-06-18"]];
  return <div className="s2-doc-list">{docs.map((d) => <div key={d[0]}><strong>{labelText(d[0])}<small>uploaded on {formatDate(d[2])}</small></strong><span className={`s2-badge ${badgeTone(d[1])}`}>{d[1]}</span></div>)}</div>;
}

export function Student2CommentsPage() {
  const [apps, setApps] = useState([]);
  const [selected, setSelected] = useState("");
  const [comment, setComment] = useState("Please find attached the requested document.");
  const [message, setMessage] = useState("");
  useEffect(() => { getApplications({ limit: 20 }).then((data) => { const rows = itemsOf(data); setApps(rows); setSelected(rows[0]?.application_id || ""); }); }, []);
  async function submit(e) { e.preventDefault(); await postJson(`/applications/${selected}/comments`, { comment }); setMessage("Comment submitted and logged."); }
  return <form className="s2-card s2-full" onSubmit={submit}><h2>3. Add Comment / Response</h2>{message && <div className="s2-success">{message}</div>}<div className="s2-form"><label>Application ID<select value={selected} onChange={(e) => setSelected(e.target.value)}>{apps.map((a) => <option key={a.application_id}>{a.application_id}</option>)}</select></label><label>Your Comment<textarea value={comment} onChange={(e) => setComment(e.target.value)} /></label><label>Attach File<input type="file" /></label></div><button>Submit Comment</button></form>;
}

export function Student2ObjectionsPage() {
  const [items, setItems] = useState([]);
  useEffect(() => { getObjections().then((data) => setItems(itemsOf(data))).catch(() => setItems([])); }, []);
  return <div className="s2-two s2-fill"><SubmitObjectionForm reload={() => getObjections().then((data) => setItems(itemsOf(data)))} /><section className="s2-card"><h2>My Objections</h2><table className="s2-table"><tbody>{(items.length ? items : [{ objection_id: "OBJ-2025-0012", reason: "Incorrect boundary", status: "under_review", created_at: "2025-06-17" }]).map((o) => <tr key={o.objection_id}><td>{o.objection_id}</td><td>{o.reason}</td><td><span className={`s2-badge ${badgeTone(o.status)}`}>{o.status}</span></td><td>{formatDate(o.created_at)}</td></tr>)}</tbody></table></section></div>;
}

function SubmitObjectionForm({ reload }) {
  const [apps, setApps] = useState([]);
  const [selected, setSelected] = useState("");
  const [reason, setReason] = useState("Incorrect boundary");
  const [details, setDetails] = useState("The boundary in the survey report does not match the actual location.");
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  useEffect(() => { getApplications({ limit: 20 }).then((data) => { const rows = itemsOf(data); setApps(rows); setSelected(rows[0]?.application_id || ""); }); }, []);
  async function submit(e) {
    e.preventDefault();
    if (!selected) {
      setMessage("Choose an application first.");
      return;
    }
    await postJson(`/applications/${selected}/objections`, { reason, details, submitted_by: { role: userSession().role, id: userSession().linkedId || "student2" }, supporting_documents: file ? [{ file_name: file.name, file_url: `/local-upload/${file.name}` }] : [] });
    setMessage("Objection submitted.");
    reload();
  }
  return <form className="s2-card" onSubmit={submit}><h2>4. Submit Objection</h2>{message && <div className="s2-success">{message}</div>}<label>Application ID<select value={selected} onChange={(e) => setSelected(e.target.value)}>{apps.map((a) => <option key={a.application_id}>{a.application_id}</option>)}</select></label><label>Objection Reason<select value={reason} onChange={(event) => setReason(event.target.value)}><option>Incorrect boundary</option><option>Missing Documents</option><option>Area calculation</option></select></label><label>Details<textarea value={details} onChange={(event) => setDetails(event.target.value)} /></label><label>Attach Supporting Documents<input type="file" onChange={(event) => setFile(event.target.files?.[0])} /></label><button className="danger">Submit Objection</button></form>;
}

export function Student2TrackPage() {
  const { id } = useParams();
  const [events, setEvents] = useState([]);
  useEffect(() => { getTimeline(id).then((data) => setEvents(data.event_stream || [])).catch(() => setEvents([])); }, [id]);
  return <section className="s2-card s2-full"><h2>Application Timeline</h2><Timeline events={events} /></section>;
}

export function Student2NotificationsPage() {
  const [notes, setNotes] = useState([]);
  useEffect(() => { getNotifications().then((data) => setNotes(itemsOf(data))).catch(() => setNotes([])); }, []);
  return <section className="s2-card s2-full"><h2>Notifications</h2><NotificationsMini notes={notes} /></section>;
}

export function Student2StaffConsolePage() {
  const [apps, setApps] = useState([]);
  const [filters, setFilters] = useState({ status: "", type: "", zone: "", search: "" });
  useEffect(() => { getApplications({ limit: 50 }).then((data) => setApps(itemsOf(data))).catch(() => setApps([])); }, []);
  const filtered = filterApplications(apps, filters);
  const count = (status) => apps.filter((app) => app.status === status).length;
  const missing = apps.filter((app) => (app.required_documents || []).some((doc) => ["missing", "pending_review", "rejected"].includes(doc.status))).length;
  const cards = [["Pending Applications", count("submitted") + count("missing_documents"), "Needs action", "blue"], ["Pre-Checked", count("pre_checked"), "Ready for survey", "yellow"], ["Legal Review", count("legal_review"), "Registrar review", "purple"], ["Missing Documents", missing, "Applicant action", "orange"], ["Under Objection", count("under_objection"), "Disputed", "red"], ["Approved", count("approved"), "Ready certificate", "green"]];
  return <div className="s2-stack"><div className="s2-kpis">{cards.map((c) => <KpiCard key={c[0]} card={c} />)}</div><div className="s2-staff-grid"><section className="s2-card span-2"><PanelTitle title="Application Management" link="/student2/applications" /><Filters filters={filters} setFilters={setFilters} /><Student2ApplicationsTable apps={filtered} /></section><section className="s2-card"><h2>Workflow Progress</h2><Timeline events={[]} /></section></div></div>;
}

export function Student2ReviewPage() {
  const [apps, setApps] = useState([]);
  const [selected, setSelected] = useState("");
  const [documentType, setDocumentType] = useState("ownership_deed");
  const [decisionNote, setDecisionNote] = useState("Document is valid and complete.");
  const [message, setMessage] = useState("");
  useEffect(() => {
    getApplications({ limit: 20 }).then((data) => {
      const rows = itemsOf(data);
      setApps(rows);
      setSelected(rows[0]?.application_id || "");
    });
  }, []);
  async function reviewDocument(decision) {
    try {
      await patchJson(`/applications/${selected}/documents/review`, { document_type: documentType, decision, rejection_reason: decision === "rejected" ? decisionNote : null });
      await patchJson(`/applications/${selected}/registrar-review`, { decision: decision === "verified" ? "approved" : "changes_requested", notes: decisionNote });
      setMessage(`Document ${decision} and registrar review saved.`);
    } catch (err) {
      setMessage(err.response?.data?.detail || "Review action could not be completed.");
    }
  }
  async function missingRequest() {
    try {
      await postJson(`/applications/${selected}/request-missing-documents`, { document_types: [documentType], note: "Please upload the missing or corrected document." });
      setMessage("Missing document request sent to applicant.");
    } catch (err) {
      setMessage(err.response?.data?.detail || "Missing document request could not be sent.");
    }
  }
  return <div className="s2-staff-grid s2-fill"><section className="s2-card"><h2>Registrar Review</h2>{message && <div className="s2-success">{message}</div>}<label>Application<select value={selected} onChange={(event) => setSelected(event.target.value)}>{apps.map((app) => <option key={app.application_id}>{app.application_id}</option>)}</select></label><label>Document<select value={documentType} onChange={(event) => setDocumentType(event.target.value)}><option>ownership_deed</option><option>id_copy</option><option>sale_contract</option><option>parcel_map</option></select></label><label>Registrar Decision / Notes<textarea value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} /></label><button type="button" onClick={() => reviewDocument("verified")}>Accept</button><button type="button" className="danger" onClick={() => reviewDocument("rejected")}>Reject</button></section><section className="s2-card"><h2>Missing Documents</h2><DocumentList /><button type="button" onClick={missingRequest}>Send Request to Applicant</button></section><section className="s2-card"><h2>Objections</h2><Student2ObjectionsMini /></section></div>;
}

function Student2ObjectionsMini() {
  return <table className="s2-table"><tbody><tr><td>OBJ-2025-0012</td><td>Incorrect boundary</td><td><span className="s2-badge warn">under_review</span></td></tr><tr><td>OBJ-2025-0005</td><td>Area calculation</td><td><span className="s2-badge good">resolved</span></td></tr></tbody></table>;
}

export function Student2CertificatesPage() {
  const [certs, setCerts] = useState([]);
  const [approved, setApproved] = useState([]);
  const [message, setMessage] = useState("");
  async function load() {
    getCertificates().then((data) => setCerts(itemsOf(data))).catch(() => setCerts([]));
    getApplications({ status: "approved", limit: 20 }).then((data) => setApproved(itemsOf(data))).catch(() => setApproved([]));
  }
  useEffect(() => { load(); }, []);
  async function generate(applicationId) {
    try {
      await postJson(`/applications/${applicationId}/certificate`, { issued_by: "student2-registrar" });
      setMessage(`Certificate generated for ${applicationId}.`);
      await load();
    } catch (err) {
      setMessage(err.response?.data?.detail || "Certificate can only be generated for approved applications.");
    }
  }
  const fallback = [{ application_number: "LRMIS-2025-0006", certificate_id: "CERT-2025-0006", status: "generated" }];
  return <section className="s2-card s2-full"><h2>Certificate Issuance</h2>{message && <div className="s2-success">{message}</div>}<table className="s2-table"><thead><tr><th>Approved Application</th><th>Certificate ID</th><th>Status</th><th>Action</th></tr></thead><tbody>{(certs.length ? certs : fallback).map((c) => <tr key={c.certificate_id}><td>{c.application_number}</td><td>{c.certificate_id}</td><td><span className={`s2-badge ${badgeTone(c.status)}`}>{c.status}</span></td><td><Link to={`/student2/track/${c.application_number}`}>View / Download</Link></td></tr>)}{approved.map((app) => <tr key={app.application_id}><td>{app.application_id}</td><td>Not generated</td><td><span className="s2-badge warn">ready</span></td><td><button type="button" onClick={() => generate(app.application_id)}>Generate Certificate</button></td></tr>)}</tbody></table></section>;
}

export function Student2SettingsPage() {
  return <div className="s2-two"><section className="s2-card"><h2>Applicant Types</h2><p>citizen, lawyer, company, surveyor, authorized representative</p></section><section className="s2-card"><h2>Verification States</h2><p>unverified, verified, suspended</p></section><section className="s2-card"><h2>MongoDB Collections</h2><p>applicants, application_documents, objections, performance_logs</p></section></div>;
}

function Timeline({ events }) {
  const fallback = statuses.map((s, index) => ({ type: s, at: index < 3 ? "2025-06-18 10:30 AM" : null, by: { role: index < 3 ? "Registrar" : "Pending" } }));
  const rows = events.length ? events : fallback;
  return <div className="s2-timeline">{rows.map((e, i) => <div className={i < 3 ? "done" : ""} key={i}><strong>{e.type}</strong><span>{formatDate(e.at)}<small>{e.by?.role}</small></span></div>)}</div>;
}

function formatDate(value) {
  if (!value) return "Pending";
  return new Date(value).toString() === "Invalid Date" ? value : new Date(value).toLocaleString();
}

function labelText(value) {
  return String(value || "-").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function filterApplications(apps, filters = {}) {
  const search = (filters.search || "").toLowerCase().trim();
  return apps.filter((app) => {
    const parcel = app.parcel_ref || {};
    const applicant = app.applicant_ref || {};
    const matchesStatus = !filters.status || app.status === filters.status;
    const matchesType = !filters.type || app.type === filters.type;
    const matchesZone = !filters.zone || parcel.zone_id === filters.zone || parcel.zone === filters.zone;
    const haystack = [app.application_id, app.type, app.status, parcel.parcel_number, parcel.zone_id, applicant.full_name].filter(Boolean).join(" ").toLowerCase();
    const matchesSearch = !search || haystack.includes(search);
    return matchesStatus && matchesType && matchesZone && matchesSearch;
  });
}
