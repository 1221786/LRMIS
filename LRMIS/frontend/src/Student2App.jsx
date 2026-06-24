import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import L from "leaflet";
import {
  api,
  getApplicant,
  getApplicantApplications,
  getApplications,
  getCertificates,
  getNotifications,
  getObjections,
  getApplicationComments,
  getApplicationDocuments,
  getApplicationObjections,
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const result = await loadStudent2Applications({ limit: 50 });
        setApps(itemsOf(result));
        setError("");
      } catch (err) {
        setError(err.response?.data?.detail || "Could not load applications.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const stats = {
    total: apps.length,
    inProgress: apps.filter((app) => app.status !== "closed" && app.status !== "certificate_issued").length,
    underReview: apps.filter((app) => ["pre_checked", "legal_review"].includes(app.status)).length,
    completed: apps.filter((app) => ["approved", "certificate_issued", "closed"].includes(app.status)).length,
  };

  return (
    <div className="s2-applicant-home">
      <header className="s2-welcome">
        <div><h1>Welcome back,<br />{session.name}</h1><p>Track your applications and manage your requests</p></div>
        <Link to="/student2/applications/new" className="s2-new-home">+ New Application</Link>
      </header>
      {error && <div className="s2-error">{error}</div>}
      <div className="s2-home-cards">
        <HomeStat label="Total Applications" value={stats.total} color="blue" />
        <HomeStat label="In Progress" value={stats.inProgress} color="purple" />
        <HomeStat label="Under Review" value={stats.underReview} color="rose" />
        <HomeStat label="Completed" value={stats.completed} color="green" />
      </div>
      <section className="s2-home-table">
        <div className="s2-panel-title"><h2>Recent Applications</h2><Link to="/student2/applications">View All</Link></div>
        {loading && <div className="s2-empty-state">Loading applications...</div>}
        {!loading && !apps.length && <div className="s2-empty-state"><strong>No applications yet</strong><span>Start by creating a new land registration application.</span><Link to="/student2/applications/new">+ New Application</Link></div>}
        {!loading && apps.length > 0 && <RecentApplicationsTable apps={apps.slice(0, 6)} />}
      </section>
    </div>
  );
}

function HomeStat({ label, value, color }) {
  return <article className={`s2-home-stat ${color}`}><b>{value}</b><span>{label}</span></article>;
}

function RecentApplicationsTable({ apps }) {
  return (
    <table className="s2-recent-table">
      <thead><tr><th>Application ID</th><th>Type</th><th>Status</th><th>Last Updated</th><th>Action</th></tr></thead>
      <tbody>{apps.map((app) => <tr key={app.application_id}><td><Link to={`/student2/applications/${app.application_id}`}>{app.application_id}</Link></td><td>{labelText(app.type || app.application_type)}</td><td><span className={`s2-mini-status ${workflowStatusTone(app.status)}`}>{workflowStatusLabel(app.status)}</span></td><td>{shortDate(app.updated_at || app.created_at || app.submitted_date)}</td><td><Link to={`/student2/applications/${app.application_id}`}>View</Link></td></tr>)}</tbody>
    </table>
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

function Student2MyApplicationsCard({ apps }) {
  const fallback = [
    { application_id: "APP-2024-001", type: "ownership_transfer", applicant_ref: { contacts: { phone: "+971 50 123 4567" } }, status: "legal_review", created_at: "2024-05-20" },
    { application_id: "APP-2024-002", type: "first_registration", applicant_ref: { contacts: { phone: "+971 50 234 5678" } }, status: "pre_checked", created_at: "2024-05-19" },
    { application_id: "APP-2024-003", type: "parcel_subdivision", applicant_ref: { contacts: { phone: "+971 50 345 6789" } }, status: "survey_required", created_at: "2024-05-18" },
    { application_id: "APP-2024-004", type: "certificate_request", applicant_ref: { contacts: { phone: "+971 50 456 7890" } }, status: "approved", created_at: "2024-05-17" },
    { application_id: "APP-2024-005", type: "boundary_correction", applicant_ref: { contacts: { phone: "+971 50 567 8901" } }, status: "rejected", created_at: "2024-05-16" },
    { application_id: "APP-2024-006", type: "", applicant_ref: { contacts: { phone: "" } }, status: "", created_at: "" },
  ];
  const rows = apps.length ? apps : fallback;
  return (
    <section className="s2-my-apps-card">
      <div className="s2-my-apps-head">
        <div><span className="s2-briefcase">▣</span><h2>My Applications</h2></div>
        <Link className="s2-new-application" to="/student2/applications/new"><b>+</b>New</Link>
      </div>
      <table className="s2-my-apps-table">
        <thead><tr><th>Application ID</th><th>Title</th><th>Phone Number</th><th>Status</th><th>Submitted On</th></tr></thead>
        <tbody>
          {rows.map((app) => {
            const phone = app.applicant_ref?.contacts?.phone || app.applicant_ref?.phone || app.contacts?.phone || "--";
            return (
              <tr key={app.application_id}>
                <td><Link to={`/student2/applications/${app.application_id}`}>{app.application_id}</Link></td>
                <td>{app.type ? labelText(app.type) : "--"}</td>
                <td>{phone || "--"}</td>
                <td><span className={`s2-status-pill ${statusTone(app.status)}`}>{student2StatusLabel(app.status)}</span></td>
                <td>{app.created_at || app.submitted_at || app.submitted_date ? shortDate(app.created_at || app.submitted_at || app.submitted_date) : "--"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
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
  const [linkedApps, setLinkedApps] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    full_name: "Amina Khaled Ahmad",
    national_id: "2000-123456-7890",
    registration_number: "",
    email: "amina.khaled@email.com",
    phone: "+962 79 123 4567",
    address_line: "Amman - Marka - Street 15",
    city: "Amman",
    neighborhood: "Marka",
    zone_id: "ZONE-AM-01",
    applicant_type: "citizen",
    verification_state: "verified",
    preferred_language: "en",
    notify_email: true,
    notify_sms: true,
    notify_status_change: true,
    notify_missing_documents: true,
    notify_certificate_ready: true,
    mask_national_id: true,
    hide_phone_from_staff: false,
    mask_email: false,
    share_contact_with_staff: true,
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const linked = userSession().linkedId;
  async function loadProfile() {
    if (linked) {
      try {
        const data = await getApplicant(linked);
        setProfile(data);
        const notificationPrefs = data.notification_preferences || data.preferences?.notifications || {};
        const privacy = data.privacy_settings || {};
        setForm({
          full_name: data.full_name || "Amina Khaled Ahmad",
          national_id: data.national_id || data.identity?.national_id || "2000-123456-7890",
          registration_number: data.registration_number || data.identity?.registration_number || "",
          email: data.contacts?.email || "amina.khaled@email.com",
          phone: data.contacts?.phone || "+962 79 123 4567",
          address_line: data.address?.line1 || "Amman - Marka - Street 15",
          city: data.address?.city || "Amman",
          neighborhood: data.address?.neighborhood || "",
          zone_id: data.address?.zone_id || "ZONE-AM-01",
          applicant_type: data.type || "citizen",
          verification_state: data.verification?.state || data.verification_state || "verified",
          preferred_language: normalizeLanguage(data.preferred_language || data.preferences?.language || "en"),
          notify_email: notificationPrefs.email ?? true,
          notify_sms: notificationPrefs.sms ?? false,
          notify_status_change: notificationPrefs.on_status_change ?? true,
          notify_missing_documents: notificationPrefs.on_missing_documents ?? true,
          notify_certificate_ready: notificationPrefs.on_certificate_ready ?? true,
          mask_national_id: privacy.mask_national_id ?? true,
          hide_phone_from_staff: privacy.hide_phone_from_staff ?? false,
          mask_email: privacy.mask_email ?? false,
          share_contact_with_staff: privacy.share_contact_with_staff ?? true,
        });
        const applications = await getApplicantApplications(linked).catch(() => ({ items: [] }));
        setLinkedApps(itemsOf(applications));
      } catch {
        setProfile(null);
        setEditing(true);
        setError("Applicant not found. Fill the profile fields and press Save Profile to create it.");
      }
    }
  }
  useEffect(() => {
    loadProfile();
  }, [linked]);

  async function save() {
    setError("");
    setMessage("Saving profile...");
    const editablePayload = {
      full_name: form.full_name,
      contacts: { email: form.email, phone: form.phone },
      address: { line1: form.address_line, city: form.city, neighborhood: form.neighborhood, zone_id: form.zone_id },
      preferred_language: form.preferred_language,
      notification_preferences: {
        email: form.notify_email,
        sms: form.notify_sms,
        on_status_change: form.notify_status_change,
        on_missing_documents: form.notify_missing_documents,
        on_certificate_ready: form.notify_certificate_ready,
      },
      preferences: {
        preferred_contact: form.notify_sms ? "sms" : "email",
        language: form.preferred_language,
        notifications: {
          email: form.notify_email,
          sms: form.notify_sms,
          on_status_change: form.notify_status_change,
          on_missing_documents: form.notify_missing_documents,
          on_certificate_ready: form.notify_certificate_ready,
        },
      },
      privacy_settings: {
        mask_national_id: form.mask_national_id,
        hide_phone_from_staff: form.hide_phone_from_staff,
        mask_email: form.mask_email,
        share_contact_with_staff: form.share_contact_with_staff,
      },
    };
    try {
      if (!linked || !profile) {
        const payload = {
          ...editablePayload,
          national_id: form.national_id,
          registration_number: form.registration_number,
          type: form.applicant_type,
          applicant_type: form.applicant_type,
          verification_state: form.verification_state,
        };
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
        data: editablePayload,
      });
      setProfile(updated);
      setEditing(false);
      setMessage("Profile updated successfully.");
      await loadProfile();
    } catch (err) {
      setMessage("");
      setError(err.response?.data?.detail || "Profile could not be saved. Check backend and login role.");
    }
  }
  return (
    <div className="s2-profile-page">
      <section className="s2-business-profile">
        <div className="s2-business-head">
          <h2>Profile {labelText(form.applicant_type)}</h2>
          <button type="button" className="s2-edit-outline" onClick={() => { setEditing(true); setMessage("Edit mode enabled. Change allowed fields then press Save Changes."); setError(""); }}>Edit Profile</button>
        </div>
        <div className="s2-business-person">
          <div className="s2-avatar-photo">{initials(form.full_name)}</div>
          <div>
            <h1>{form.full_name}</h1>
            <span className={`s2-verify ${form.verification_state}`}>✓ {labelText(form.verification_state)}</span>
          </div>
        </div>
        <dl className="s2-business-dl">
          <dt>{form.applicant_type === "company" ? "Business ID" : "National ID"}</dt><dd>{form.registration_number || form.national_id}</dd>
          <dt>Email</dt><dd>{form.email}</dd>
          <dt>Phone</dt><dd>{form.phone}</dd>
          <dt>Address</dt><dd>{[form.address_line, form.neighborhood, form.city, form.zone_id].filter(Boolean).join(", ")}</dd>
          <dt>Language</dt><dd>{form.preferred_language === "ar" ? "Arabic" : "English"}</dd>
          <dt>Linked Applications</dt><dd>Linked ({linkedApps.length})</dd>
          <dt>Privacy</dt><dd>{form.share_contact_with_staff ? "Visible to officials: yes" : "Visible to officials: limited"}</dd>
        </dl>
        <Link className="s2-full-profile-link" to="/student2/applications">View Linked Applications →</Link>
      </section>
      <section className="s2-card s2-profile-editor" id="profile-settings">
        <div className="s2-panel-title"><h2>{editing ? "Edit Profile Settings" : "Profile Settings"}</h2>{editing && <button type="button" className="s2-edit-btn" onClick={() => { setEditing(false); loadProfile(); }}>Cancel</button>}</div>
        {message && <div className="s2-success">{message}</div>}
        {error && <div className="s2-error">{error}</div>}
        <ProfileFields form={form} setForm={setForm} disabled={!editing} />
        <div className="s2-linked-box">
          <h3>Linked Applications</h3>
          {(linkedApps.length ? linkedApps : []).map((app) => <Link key={app.application_id} to={`/student2/track/${app.application_id}`}>{app.application_id} - {app.status}</Link>)}
          {!linkedApps.length && <span>No linked applications yet.</span>}
        </div>
        <button type="button" disabled={!editing} onClick={save}>{profile ? "Save Changes" : "Create Profile"}</button>
      </section>
    </div>
  );
}

function ProfileFields({ form, setForm, disabled = false }) {
  const set = (field, value) => setForm({ ...form, [field]: value });
  const checkbox = (field, label) => <label className="s2-check"><input disabled={disabled} type="checkbox" checked={Boolean(form[field])} onChange={(event) => set(field, event.target.checked)} />{label}</label>;
  return (
    <div className="s2-form">
      <label>Full Name<input disabled={disabled} value={form.full_name} onChange={(event) => set("full_name", event.target.value)} /></label>
      <label>National ID<input disabled value={form.national_id} readOnly /></label>
      <label>Registration Number<input disabled value={form.registration_number} readOnly placeholder="Company or lawyer registration number" /></label>
      <label>Email<input disabled={disabled} value={form.email} onChange={(event) => set("email", event.target.value)} /></label>
      <label>Phone<input disabled={disabled} value={form.phone} onChange={(event) => set("phone", event.target.value)} /></label>
      <label>Address<input disabled={disabled} value={form.address_line} onChange={(event) => set("address_line", event.target.value)} /></label>
      <label>City<input disabled={disabled} value={form.city} onChange={(event) => set("city", event.target.value)} /></label>
      <label>Neighborhood<input disabled={disabled} value={form.neighborhood} onChange={(event) => set("neighborhood", event.target.value)} /></label>
      <label>Zone ID<input disabled={disabled} value={form.zone_id} onChange={(event) => set("zone_id", event.target.value)} /></label>
      <label>Applicant Type<select disabled value={form.applicant_type} readOnly><option>citizen</option><option>lawyer</option><option>company</option><option>surveyor</option><option>authorized_representative</option></select></label>
      <label>Verification State<select disabled value={form.verification_state} readOnly><option>unverified</option><option>verified</option><option>suspended</option></select></label>
      <label>Preferred Language<select disabled={disabled} value={form.preferred_language} onChange={(event) => set("preferred_language", event.target.value)}><option value="en">English</option><option value="ar">Arabic</option></select></label>
      <fieldset className="s2-fieldset"><legend>Notification Preferences</legend>{checkbox("notify_email", "Email stub")}{checkbox("notify_sms", "SMS stub")}{checkbox("notify_status_change", "On status change")}{checkbox("notify_missing_documents", "On missing documents")}{checkbox("notify_certificate_ready", "On certificate ready")}</fieldset>
      <fieldset className="s2-fieldset"><legend>Privacy Settings</legend>{checkbox("mask_national_id", "Mask National ID for staff")}{checkbox("hide_phone_from_staff", "Hide phone from staff")}{checkbox("mask_email", "Mask email for staff")}{checkbox("share_contact_with_staff", "Share contact with authorized staff")}</fieldset>
    </div>
  );
}

export function Student2ApplicationsPage() {
  const [apps, setApps] = useState([]);
  const [filters, setFilters] = useState({ status: "", type: "", zone: "", date: "", applicant: "", parcel: "", search: "" });
  useEffect(() => { loadStudent2Applications({ limit: 50 }).then((data) => setApps(itemsOf(data))).catch(() => setApps([])); }, []);
  const filtered = filterApplications(apps, filters);
  return <div className="s2-applications-page"><Student2MyApplicationsCard apps={filtered} /><section className="s2-card"><h2>Search & Filter Linked Applications</h2><Filters filters={filters} setFilters={setFilters} /></section></div>;
}

export function Student2ApplicationDetailsPage() {
  const { id } = useParams();
  const [app, setApp] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [note, setNote] = useState("Document is valid and complete.");
  const [comment, setComment] = useState("تم إرفاق الوثيقة المطلوبة.");
  const [objectionReason, setObjectionReason] = useState("Incorrect boundary");
  const [documentType, setDocumentType] = useState("ownership_deed");
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const session = userSession();
  const isStaff = session.role === "staff";

  async function load() {
    setError("");
    const application = await api(`/applications/${id}`);
    setApp(application);
    const log = await getTimeline(id).catch(() => ({ event_stream: [] }));
    setTimeline(log.event_stream || []);
  }

  useEffect(() => {
    load().catch((err) => setError(err.response?.data?.detail || "Could not load application details."));
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

  async function uploadDocument(event) {
    event.preventDefault();
    await postJson(`/applications/${id}/documents`, {
      document_type: documentType,
      file_name: file?.name || "supporting_document.pdf",
      file_url: `/local-upload/${file?.name || "supporting_document.pdf"}`,
      status: "pending_review",
    });
    setMessage("Document uploaded and saved.");
    await load();
  }

  async function submitComment(event) {
    event.preventDefault();
    await postJson(`/applications/${id}/comments`, { comment, actor: { role: session.role, id: session.linkedId } });
    setMessage("Comment / response saved.");
    await load();
  }

  async function submitObjection(event) {
    event.preventDefault();
    await postJson(`/applications/${id}/objections`, {
      reason: objectionReason,
      details: objectionReason,
      submitted_by: { role: session.role, id: session.linkedId },
      supporting_documents: file ? [{ file_name: file.name, file_url: `/local-upload/${file.name}` }] : [],
    });
    setMessage("Objection submitted and saved.");
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

  if (!app) return <section className="s2-card s2-full"><h2>Application Details</h2>{error ? <div className="s2-error">{error}</div> : "Loading..."}</section>;

  const documents = app.required_documents || app.attachments || app.documents || [];
  const comments = app.comments || [];
  const objections = app.objections || [];
  const parcel = app.parcel_ref || app.parcel || {};
  const applicant = app.applicant_ref || {};

  return (
    <div className="s2-details-page">
      <section className="s2-land-detail-card">
        <div className="s2-land-detail-head">
          <div><span className="s2-land-icon">▣</span><h1>Submit Land Application</h1></div>
          <div className="s2-land-head-actions"><Link to="/student2/applications">Back</Link><button type="button" onClick={() => window.history.back()}>×</button></div>
        </div>
        <div className="s2-land-steps">
          <span className="active"><b>1</b>Basic Information</span>
          <span><b>2</b>Documents</span>
          <span><b>3</b>Map</span>
          <span><b>4</b>Review</span>
        </div>
        {message && <div className="s2-success">{message}</div>}
        {error && <div className="s2-error">{error}</div>}
        <div className="s2-land-detail-body">
          <div>
            <h2>Application Details</h2>
            <dl className="s2-land-dl">
              <dt>Application ID</dt><dd>{app.application_id}</dd>
              <dt>Application Type</dt><dd>{labelText(app.type || app.application_type)}</dd>
              <dt>Applicant Type</dt><dd>{labelText(applicant.type || "individual")}</dd>
              <dt>Applicant Name</dt><dd>{applicant.full_name || "-"}</dd>
              <dt>Phone Number</dt><dd>{applicant.contacts?.phone || applicant.phone || "-"}</dd>
              <dt>Location</dt><dd>{parcel.zone_id || "-"}<strong>Sector: {parcel.block_number || "-"}</strong></dd>
              <dt>Area</dt><dd>{parcel.area_sqm || app.parcel?.area_sqm || "600"} m²<strong>Unit: m²</strong></dd>
              <dt>Plot No.</dt><dd>{parcel.parcel_number || "-"}</dd>
              <dt>Status</dt><dd><span className={`s2-status-pill ${statusTone(app.status)}`}>{student2StatusLabel(app.status)}</span></dd>
              <dt>Submitted On</dt><dd>{shortDate(app.created_at || app.submitted_at || app.submitted_date)}</dd>
            </dl>
          </div>
          <div className="s2-land-map-column">
            <div className="s2-satellite-map">
              <button>+</button><button>−</button><button>⌖</button>
              <span className="layer">▱</span>
              <span className="target">⌾</span>
              <div className="parcel-shape" />
            </div>
            <Link className="s2-edit-application-button" to={`/student2/applications/${app.application_id}`}>✎ View / Edit Application</Link>
          </div>
        </div>
      </section>

      <section className="s2-card">
        <h2>Uploaded Documents</h2>
        <div className="s2-doc-list">
          {documents.length ? documents.map((doc, index) => <div key={`${doc.document_type}-${index}`}><strong>{labelText(doc.document_type)}<small>{doc.file_name || "No file uploaded yet"}</small></strong><span className={`s2-badge ${badgeTone(doc.status)}`}>{doc.status || "pending"}</span></div>) : <span>No documents uploaded yet.</span>}
        </div>
        <form className="s2-inline-form" onSubmit={uploadDocument}>
          <select value={documentType} onChange={(event) => setDocumentType(event.target.value)}><option>ownership_deed</option><option>id_copy</option><option>sale_contract</option><option>parcel_map</option><option>tax_clearance</option></select>
          <input type="file" onChange={(event) => setFile(event.target.files?.[0])} />
          <button type="submit">Upload Document</button>
        </form>
      </section>

      <section className="s2-card">
        <h2>Comments / Responses</h2>
        <div className="s2-mini-list">{comments.length ? comments.map((item, index) => <span key={index}>{item.comment}<small>{formatDate(item.created_at)}</small></span>) : <span>No comments yet.</span>}</div>
        <form className="s2-inline-form" onSubmit={submitComment}>
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} />
          <button type="submit">Add Comment</button>
        </form>
      </section>

      <section className="s2-card">
        <h2>Objections</h2>
        <div className="s2-mini-list">{objections.length ? objections.map((item) => <span key={item.objection_id}>{item.objection_id} - {item.reason}<small>{item.status}</small></span>) : <span>No objections submitted.</span>}</div>
        <form className="s2-inline-form" onSubmit={submitObjection}>
          <select value={objectionReason} onChange={(event) => setObjectionReason(event.target.value)}><option>Incorrect boundary</option><option>Missing Documents</option><option>Area calculation</option></select>
          <button type="submit" className="danger">Submit Objection</button>
        </form>
      </section>

      <section className="s2-card">
        <h2>Timeline / Status History</h2>
        <Timeline events={timeline} />
      </section>

      {isStaff && <section className="s2-card">
        <h2>Registrar Actions</h2>
        <label>Internal Note<textarea value={note} onChange={(event) => setNote(event.target.value)} /></label>
        <div className="s2-action-row">
          <button type="button" onClick={addNote}>Save Note</button>
          <button type="button" onClick={requestMissing}>Request Missing Documents</button>
          <button type="button" onClick={() => transition("pre_checked")}>Pre-check</button>
          <button type="button" onClick={() => transition("legal_review")}>Send Legal Review</button>
          <button type="button" onClick={() => transition("approved")}>Approve Application</button>
          <button type="button" className="danger" onClick={reject}>Reject Application</button>
        </div>
      </section>
      }
    </div>
  );
}

function Filters({ filters = {}, setFilters }) {
  const [message, setMessage] = useState("");
  const update = (field, value) => {
    if (setFilters) setFilters({ ...filters, [field]: value });
  };
  return <><div className="s2-filters s2-filters-wide"><select value={filters.status || ""} onChange={(event) => update("status", event.target.value)}><option value="">All Statuses</option><option>submitted</option><option>pre_checked</option><option>survey_required</option><option>surveyed</option><option>legal_review</option><option>approved</option><option>under_objection</option><option>missing_documents</option><option>rejected</option></select><select value={filters.type || ""} onChange={(event) => update("type", event.target.value)}><option value="">All Types</option><option>ownership_transfer</option><option>first_registration</option><option>parcel_subdivision</option><option>boundary_correction</option><option>certificate_request</option></select><select value={filters.zone || ""} onChange={(event) => update("zone", event.target.value)}><option value="">All Zones</option><option>RM-01</option><option>RM-02</option><option>RM-03</option><option>ZONE-RM-01</option><option>ZONE-RM-02</option><option>ZONE-RM-03</option></select><input type="date" value={filters.date || ""} onChange={(event) => update("date", event.target.value)} /><input value={filters.applicant || ""} onChange={(event) => update("applicant", event.target.value)} placeholder="Applicant..." /><input value={filters.parcel || ""} onChange={(event) => update("parcel", event.target.value)} placeholder="Parcel..." /><input value={filters.search || ""} onChange={(event) => update("search", event.target.value)} placeholder="Search by ID, applicant, parcel..." /><button type="button" onClick={() => setMessage("Filters applied to the table.")}>Filters</button></div>{message && <div className="s2-success">{message}</div>}</>;
}

export function Student2NewApplicationPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [form, setForm] = useState({
    full_name: "Amina Khaled Ahmad",
    national_id: "2000-123456-7890",
    email: "amina.khaled@email.com",
    phone: "+962791234567",
    address_line: "Amman - Marka",
    applicant_type: "citizen",
    preferred_language: "en",
    type: "ownership_transfer",
    land_type: "residential",
    purpose: "Transfer of ownership",
    parcel_number: "145/12",
    block_number: "12",
    basin_number: "3",
    zone_id: "Al Ain Zone",
    area_sqm: "600.5",
    frontage_m: "50.00",
    depth_m: "48.00",
    registered_owner: "Ahmad Khaled",
    land_use: "residential",
    registration_status: "pending_registration",
    location_notes: "Drawn parcel boundary near main road",
    coordinates: [
      [35.2, 31.9],
      [35.21, 31.9],
      [35.21, 31.91],
      [35.2, 31.91],
      [35.2, 31.9],
    ],
  });
  const [documents, setDocuments] = useState([
    { document_type: "id_copy", file_name: "id-copy.pdf", file_size: "1.2 MB", status: "uploaded" },
    { document_type: "ownership_deed", file_name: "ownership-deed.pdf", file_size: "2.4 MB", status: "uploaded" },
    { document_type: "sale_contract", file_name: "", file_size: "", status: "missing" },
  ]);
  useEffect(() => {
    const linkedId = userSession().linkedId;
    if (linkedId) {
      getApplicant(linkedId).then((data) => {
        setProfile(data);
        setForm((current) => ({
          ...current,
          full_name: data.full_name || current.full_name,
          national_id: data.national_id || data.identity?.national_id || current.national_id,
          email: data.contacts?.email || current.email,
          phone: data.contacts?.phone || current.phone,
          address_line: data.address?.line1 || current.address_line,
          applicant_type: data.type || current.applicant_type,
          preferred_language: normalizeLanguage(data.preferred_language || data.preferences?.language || current.preferred_language),
        }));
      }).catch(() => null);
    }
  }, []);

  function validateStep(targetStep = step) {
    const required = [];
    if (targetStep >= 1) {
      if (!form.type) required.push("Application type");
      if (!form.applicant_type) required.push("Applicant type");
      if (!form.land_type) required.push("Land use type");
      if (!form.purpose) required.push("Purpose of application");
    }
    if (targetStep >= 2) {
      if (!form.parcel_number) required.push("Parcel number");
      if (!form.block_number) required.push("Block number");
      if (!form.basin_number) required.push("Basin number");
      if (!form.zone_id) required.push("Zone");
      if (!form.area_sqm || Number(form.area_sqm) <= 0) required.push("Area greater than zero");
    }
    if (targetStep >= 3) {
      if (!form.coordinates?.length || form.coordinates.length < 4) required.push("Valid GeoJSON polygon");
    }
    if (targetStep >= 4) {
      const uploadedTypes = documents.filter((doc) => doc.status !== "missing" && doc.file_name).map((doc) => doc.document_type);
      const missingRequired = requiredDocumentsForType(form.type).filter((doc) => !uploadedTypes.includes(doc));
      if (missingRequired.length) required.push(`Required documents: ${missingRequired.map(documentTitle).join(", ")}`);
    }
    if (required.length) {
      setError(`Please complete: ${required.join(", ")}`);
      return false;
    }
    setError("");
    return true;
  }

  function goTo(nextStep) {
    if (nextStep <= step || validateStep(step)) setStep(nextStep);
  }

  function addDocument(file, documentType) {
    setError("");
    const chosen = file?.[0];
    if (!chosen) return;
    const allowedNames = [".pdf", ".jpg", ".jpeg", ".png"];
    if (!allowedNames.some((ext) => chosen.name.toLowerCase().endsWith(ext))) {
      setError("Only PDF, JPG, and PNG files are allowed.");
      return;
    }
    if (chosen.size > 10 * 1024 * 1024) {
      setError("File size must be 10MB or less.");
      return;
    }
    setDocuments((current) => {
      if (documentType === "supporting_document") {
        return [...current, { document_type: `supporting_document_${Date.now()}`, file_name: chosen.name, file_size: formatFileSize(chosen.size), status: "uploaded" }];
      }
      const next = current.filter((doc) => doc.document_type !== documentType);
      return [...next, { document_type: documentType, file_name: chosen.name, file_size: formatFileSize(chosen.size), status: "uploaded" }];
    });
  }

  function removeDocument(documentType) {
    setDocuments((current) => current.map((doc) => doc.document_type === documentType ? { ...doc, file_name: "", file_size: "", status: "missing" } : doc));
  }

  function saveDraft() {
    localStorage.setItem("student2_application_draft", JSON.stringify({ form, documents, saved_at: new Date().toISOString() }));
    setDraftMessage("Draft saved locally.");
  }

  async function submit(e) {
    e.preventDefault();
    if (!validateStep(4)) return;
    const payload = {
      type: form.type,
      applicant: { full_name: form.full_name, national_id: form.national_id, contacts: { email: form.email, phone: form.phone }, address: { line1: form.address_line }, type: form.applicant_type },
      parcel: {
        parcel_number: form.parcel_number,
        block_number: form.block_number,
        basin_number: form.basin_number,
        zone_id: form.zone_id,
        area_sqm: Number(form.area_sqm),
        frontage_m: Number(form.frontage_m || 0),
        depth_m: Number(form.depth_m || 0),
        registered_owner: form.registered_owner,
        description: form.location_notes,
        land_use: form.land_use,
        registration_status: form.registration_status,
        geometry: { type: "Polygon", coordinates: [form.coordinates] },
      },
      documents: documents.filter((doc) => doc.file_name).map((doc) => ({ document_type: doc.document_type, file_name: doc.file_name, file_url: `/local-upload/${doc.file_name}`, status: "pending_review" })),
    };
    const created = await postJson("/applications/", payload, { "Idempotency-Key": `s2-${Date.now()}` });
    navigate(`/student2/track/${created.application_id}`);
  }

  return (
    <form className="s2-submit-wizard" onSubmit={submit}>
      <div className="s2-submit-head">
        <div><h1>Submit Land Application</h1><p>File an official land registration request</p></div>
        <button type="button" onClick={saveDraft}>Save as Draft</button>
      </div>
      <SubmitStepper step={step} setStep={goTo} />
      {profile && <div className="s2-success">Application will be linked to applicant profile: {profile.full_name}</div>}
      {draftMessage && <div className="s2-success">{draftMessage}</div>}
      {error && <div className="s2-error">{error}</div>}

      {step === 1 && <section className="s2-submit-section s2-step-screen">
        <ApplicationInputs form={form} setForm={setForm} />
      </section>}

      {step === 2 && <section className="s2-submit-section s2-step-screen">
        <ParcelInputs form={form} setForm={setForm} />
      </section>}

      {step === 3 && <section className="s2-submit-section s2-map-section">
        <MapSelectionStep form={form} setForm={setForm} />
      </section>}

      {step === 4 && <section className="s2-submit-section">
        <h2><span>4</span>Documents</h2>
        <SubmitDocuments documents={documents} addDocument={addDocument} removeDocument={removeDocument} applicationType={form.type} />
      </section>}

      {step === 5 && <section className="s2-submit-section">
        <ReviewSubmitStep form={form} documents={documents} />
      </section>}

      <div className="s2-submit-actions">
        {step > 1 && <button type="button" onClick={() => setStep(Math.max(1, step - 1))}>Back</button>}
        {step < 5 && <button type="button" onClick={() => goTo(Math.min(5, step + 1))}>Next</button>}
        {step === 5 && <button type="submit">Review & Submit Application</button>}
      </div>
    </form>
  );
}

function ApplicationInputs({ form, setForm }) {
  const set = (field, value) => setForm({ ...form, [field]: value });
  return <div className="s2-basic-step"><div className="s2-basic-fields"><label>Application Type <span>*</span><select value={form.type} onChange={(e) => set("type", e.target.value)}><option value="">Select application type</option><option value="ownership_transfer">Ownership Transfer</option><option value="first_registration">First Registration</option><option value="parcel_subdivision">Subdivision</option><option value="parcel_merge">Merge</option><option value="boundary_correction">Boundary Correction</option></select></label><label>Applicant Type <span>*</span><select value={form.applicant_type} onChange={(e) => set("applicant_type", e.target.value)}><option value="citizen">Individual</option><option value="company">Company</option><option value="lawyer">Lawyer</option><option value="authorized_representative">Representative</option></select></label><label>Land Use Type <span>*</span><select value={form.land_type} onChange={(e) => { setForm({ ...form, land_type: e.target.value, land_use: e.target.value }); }}><option value="residential">Residential</option><option value="commercial">Commercial</option><option value="agricultural">Agricultural</option></select></label><label>Purpose of Application <span>*</span><input value={form.purpose} onChange={(e) => set("purpose", e.target.value)} placeholder="Transfer of ownership" /></label><label>Preferred Language<select value={form.preferred_language} onChange={(e) => set("preferred_language", e.target.value)}><option value="en">English</option><option value="ar">Arabic</option></select></label></div><aside className="s2-type-panel"><h3>Application Types</h3><ul><li>Ownership Transfer</li><li>First Registration</li><li>Subdivision</li><li>Merge</li><li>Boundary Correction</li></ul></aside></div>;
}

function ParcelInputs({ form, setForm }) {
  const set = (field, value) => setForm({ ...form, [field]: value });
  return <div className="s2-parcel-step"><label>Parcel Number <span>*</span><input value={form.parcel_number} onChange={(e) => set("parcel_number", e.target.value)} /></label><label>Block Number<input value={form.block_number} onChange={(e) => set("block_number", e.target.value)} /></label><label>Basin Number<input value={form.basin_number} onChange={(e) => set("basin_number", e.target.value)} /></label><label>Zone <span>*</span><select value={form.zone_id} onChange={(e) => set("zone_id", e.target.value)}><option>Al Ain Zone</option><option>Dubai Zone</option><option>Abu Dhabi Zone</option><option>RM-01</option><option>RM-02</option><option>ZONE-RM-01</option></select></label><label>Area (m²) <span>*</span><div className="s2-unit-input"><input type="number" value={form.area_sqm} onChange={(e) => set("area_sqm", e.target.value)} /><em>m²</em></div></label><label>Frontage (m)<input type="number" value={form.frontage_m} onChange={(e) => set("frontage_m", e.target.value)} /></label><label>Depth (m)<input type="number" value={form.depth_m} onChange={(e) => set("depth_m", e.target.value)} /></label><label>Registered Owner (if any)<input value={form.registered_owner} onChange={(e) => set("registered_owner", e.target.value)} /></label><label className="span-4">Parcel Description / Address<textarea value={form.location_notes} onChange={(e) => set("location_notes", e.target.value)} /></label></div>;
}

function MapSelectionStep({ form, setForm }) {
  const holderRef = useRef(null);
  const mapRef = useRef(null);
  const polygonRef = useRef(null);
  const isValid = form.coordinates?.length >= 4;
  useEffect(() => {
    if (!holderRef.current || mapRef.current) return;
    mapRef.current = L.map(holderRef.current, { zoomControl: false }).setView([31.902, 35.202], 16);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(mapRef.current);
    L.control.zoom({ position: "topleft" }).addTo(mapRef.current);
    setTimeout(() => mapRef.current?.invalidateSize(), 80);
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      polygonRef.current = null;
    };
  }, []);
  useEffect(() => {
    if (!mapRef.current) return;
    if (polygonRef.current) {
      polygonRef.current.remove();
      polygonRef.current = null;
    }
    if (isValid) {
      const latLngs = form.coordinates.map(([lng, lat]) => [lat, lng]);
      polygonRef.current = L.polygon(latLngs, { color: "#2563eb", fillColor: "#3b82f6", fillOpacity: 0.35, weight: 3 }).addTo(mapRef.current);
      mapRef.current.fitBounds(polygonRef.current.getBounds(), { padding: [20, 20] });
    }
  }, [form.coordinates, isValid]);
  const drawPolygon = () => setForm({
    ...form,
    area_sqm: "2450",
    coordinates: [
      [35.1984, 31.9032],
      [35.2012, 31.9054],
      [35.2051, 31.9046],
      [35.2063, 31.9011],
      [35.2026, 31.8994],
      [35.1984, 31.9032],
    ],
  });
  const clearPolygon = () => setForm({ ...form, coordinates: [] });
  const searchLocation = (event) => {
    const value = event.target.value;
    setForm({ ...form, location_search: value, zone_id: value ? form.zone_id : form.zone_id });
    if (value) mapRef.current?.setView([31.902, 35.202], 16);
  };
  return (
    <div className="s2-map-step">
      <aside className="s2-map-tools">
        <button type="button" className="s2-map-close">x</button>
        <h3>Select Parcel Location</h3>
        <p>Search for your location or draw the parcel boundary on the map.</p>
        <div className="s2-map-tool-row">
          <button type="button" onClick={drawPolygon}>Draw Polygon</button>
          <button type="button" className="danger" onClick={clearPolygon}>Clear</button>
        </div>
        <label className="s2-map-search">
          <input value={form.location_search || ""} onChange={searchLocation} placeholder="Search location" />
          <span>⌕</span>
        </label>
      </aside>
      <div className="s2-map-canvas s2-real-map-canvas">
        <div ref={holderRef} className="s2-leaflet-map" />
        <div className="s2-map-zoom"><button type="button">+</button><button type="button">-</button><button type="button">⛶</button></div>
        <button type="button" className="s2-map-layers">▧</button>
        <button type="button" className="s2-map-expand">⛶</button>
        {isValid && <div className="parcel-shape" />}
      </div>
      <div className="s2-map-footer">
        <span className={isValid ? "valid" : "invalid"}>{isValid ? "Parcel location is valid" : "Draw a parcel polygon to continue"}</span>
        <strong>Area: {Number(form.area_sqm || 0).toLocaleString()} m²</strong>
      </div>
    </div>
  );
}

function SubmitStepper({ step, setStep }) {
  const labels = ["Basic Information", "Parcel Details", "Map Location", "Documents", "Review & Submit"];
  return <div className="s2-submit-stepper">{labels.map((label, index) => <button type="button" key={label} className={step >= index + 1 ? "active" : ""} onClick={() => setStep(index + 1)}><b>{index + 1}</b><span>{label}</span></button>)}</div>;
}

function SubmitDocuments({ documents, addDocument, removeDocument, applicationType }) {
  const [preview, setPreview] = useState(null);
  const required = requiredDocumentsForType(applicationType);
  const extraDocs = documents.filter((doc) => doc.file_name && !required.includes(doc.document_type));
  const rows = [...required.map((type) => documents.find((item) => item.document_type === type) || { document_type: type, status: "missing" }), ...extraDocs];
  const descriptions = {
    id_copy: "Applicant ID copy",
    ownership_deed: "Proof of ownership",
    sale_contract: "Sales / transfer contract",
    proof_of_ownership: "Proof of ownership",
    parcel_map: "Parcel map or site plan",
    site_plan: "Parcel map or site plan",
    survey_report: "Latest survey report",
    supporting_document: "Any other supporting docs",
  };
  return (
    <div className="s2-doc-step">
      <div className="s2-doc-required">* Required documents</div>
      <table className="s2-doc-table">
        <thead><tr><th>Document Type</th><th>Description</th><th>File</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>{rows.map((doc) => {
          const type = doc.document_type;
          const uploaded = Boolean(doc.file_name);
          return (
            <tr key={type}>
              <td><strong>{documentTitle(type)}{required.includes(type) && <span>*</span>}</strong></td>
              <td>{descriptions[type] || "Any other supporting docs"}</td>
              <td>{uploaded ? <button type="button" className="s2-file-link" onClick={() => setPreview(doc)}>{doc.file_name}</button> : <label className="s2-inline-upload">Choose file<input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => addDocument(event.target.files, type)} /></label>}</td>
              <td><span className={`s2-doc-status ${uploaded ? "uploaded" : "pending"}`}>{uploaded ? "Uploaded" : "Pending"}</span></td>
              <td><div className="s2-doc-actions"><button type="button" disabled={!uploaded} onClick={() => window.alert(`${doc.file_name || "No file"} is registered for preview.`)}>👁</button><button type="button" disabled={!uploaded} onClick={() => removeDocument(type)}>🗑</button></div></td>
            </tr>
          );
        })}</tbody>
      </table>
      <label className="s2-upload-more">+ Upload More Documents<input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => addDocument(event.target.files, "supporting_document")} /></label>
      {preview && <div className="s2-doc-preview"><strong>File Preview</strong><span>{documentTitle(preview.document_type)} - {preview.file_name}</span><button type="button" onClick={() => setPreview(null)}>Close</button></div>}
    </div>
  );
}

function ReviewSubmitStep({ form, documents }) {
  const uploaded = documents.filter((doc) => doc.file_name);
  const required = requiredDocumentsForType(form.type);
  const missing = required.filter((type) => !uploaded.some((doc) => doc.document_type === type));
  return (
    <div className="s2-review-step">
      <section className="s2-review-summary">
        <h3>Application Summary</h3>
        <dl>
          <dt>Application Type</dt><dd>{labelText(form.type)}</dd>
          <dt>Applicant Type</dt><dd>{form.applicant_type === "citizen" ? "Individual" : labelText(form.applicant_type)}</dd>
          <dt>Land Use Type</dt><dd>{labelText(form.land_type)}</dd>
          <dt>Parcel Number</dt><dd>{form.parcel_number}</dd>
          <dt>Block / Basin / Zone</dt><dd>{form.block_number} / {form.basin_number} / {form.zone_id}</dd>
          <dt>Zone</dt><dd>{form.zone_id}</dd>
          <dt>Area</dt><dd>{Number(form.area_sqm || 0).toLocaleString()} m²</dd>
          <dt>Purpose</dt><dd>{form.purpose}</dd>
        </dl>
      </section>
      <section className="s2-review-map">
        <h3>Parcel Location</h3>
        <div className="s2-map-canvas"><div className="parcel-shape" /></div>
        <Link to="#" onClick={(event) => event.preventDefault()}>View on Map</Link>
      </section>
      <section className="s2-review-files">
        <h3>Documents ({uploaded.length})</h3>
        <ul className="s2-review-docs">
          {[...required, ...uploaded.filter((doc) => !required.includes(doc.document_type)).map((doc) => doc.document_type)].map((type) => {
            const doc = uploaded.find((item) => item.document_type === type);
            return <li key={type}><span>{doc?.file_name || documentTitle(type)}</span><b className={doc ? "uploaded" : "missing"}>{doc ? "Uploaded" : "Missing"}</b></li>;
          })}
        </ul>
        <Link to="#" onClick={(event) => event.preventDefault()}>View All</Link>
        {missing.length > 0 && <p className="s2-review-warning">Missing required: {missing.map(documentTitle).join(", ")}</p>}
      </section>
      <label className="s2-confirm"><input type="checkbox" required /> I hereby confirm that all the information provided is true and correct.</label>
    </div>
  );
}

export function Student2DocumentsPage() {
  const [apps, setApps] = useState([]);
  const [selected, setSelected] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { loadStudent2Applications({ limit: 20 }).then((data) => { const rows = itemsOf(data); setApps(rows); setSelected(rows[0]?.application_id || ""); }); }, []);

  const selectedApp = apps.find((item) => item.application_id === selected);
  const documents = normalizeDocuments(selectedApp);

  function chooseFile(value) {
    setError("");
    const chosen = value?.[0];
    if (!chosen) return;
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    const allowedNames = [".pdf", ".jpg", ".jpeg", ".png"];
    const lower = chosen.name.toLowerCase();
    if (!allowed.includes(chosen.type) && !allowedNames.some((ext) => lower.endsWith(ext))) {
      setError("Only PDF, JPG, and PNG files are allowed.");
      setFile(null);
      return;
    }
    if (chosen.size > 10 * 1024 * 1024) {
      setError("File size must be 10MB or less.");
      setFile(null);
      return;
    }
    setFile(chosen);
    setProgress(35);
  }

  function removeFile() {
    setFile(null);
    setProgress(0);
    setError("");
  }

  async function upload(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!selected) {
      setError("Choose an application first.");
      return;
    }
    if (!documentType) {
      setError("Select document type before uploading.");
      return;
    }
    if (!file) {
      setError("Choose a PDF, JPG, or PNG file first.");
      return;
    }
    setProgress(65);
    const body = new FormData();
    body.append("document_type", documentType);
    body.append("file", file);
    body.append("file_size", formatFileSize(file.size));
    body.append("status", "pending_review");
    await api(`/applications/${selected}/documents`, { method: "POST", data: body, headers: { "Content-Type": "multipart/form-data" } });
    setProgress(100);
    setMessage("Document uploaded successfully and saved to MongoDB.");
    setFile(null);
    setDocumentType("");
    const refreshed = await loadStudent2Applications({ limit: 20 });
    const rows = itemsOf(refreshed);
    setApps(rows);
    setSelected(selected || rows[0]?.application_id || "");
  }

  return (
    <section className="s2-upload-card">
      <form onSubmit={upload}>
        <div className="s2-upload-head">
          <div><span>2</span><h1>Upload Additional Documents</h1><p>Upload any required documents</p></div>
          <button type="button" className="s2-guidelines">▤ View Guidelines</button>
        </div>
        {message && <div className="s2-success">{message}</div>}
        {error && <div className="s2-error">{error}</div>}
        <label className="s2-upload-application">Application<select value={selected} onChange={(event) => setSelected(event.target.value)}>{apps.map((app) => <option key={app.application_id}>{app.application_id}</option>)}</select></label>
        <label className="s2-upload-type">Document Type<select value={documentType} onChange={(event) => setDocumentType(event.target.value)}><option value="">Select document type</option><option value="id_copy">ID Copy</option><option value="ownership_deed">Ownership Deed</option><option value="sale_contract">Sale Contract</option><option value="site_plan">Site Plan</option><option value="power_of_attorney">Power of Attorney</option><option value="survey_report">Survey Report</option></select></label>
        <div className="s2-upload-main">
          <label className="s2-upload-drop">
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => chooseFile(event.target.files)} />
            <span className="s2-cloud">☁↑</span>
            <strong>Drag & Drop Files Here</strong>
            <em>or <b>Click to Browse</b></em>
            <small>PDF, JPG, PNG (Max. 10MB)</small>
          </label>
          <div className="s2-uploaded-docs">
            <h2>Uploaded Documents</h2>
            {documents.map((doc) => <DocumentRow key={doc.key} doc={doc} />)}
            {!documents.length && <p>No uploaded documents yet.</p>}
          </div>
        </div>
        {file && <div className="s2-file-preview"><strong>{file.name}</strong><span>{formatFileSize(file.size)}</span><button type="button" onClick={removeFile}>Remove</button><div><i style={{ width: `${progress}%` }} /></div></div>}
        <button className="s2-submit-documents" type="submit">→ Submit Documents</button>
      </form>
    </section>
  );
}

function DocumentList({ app }) {
  const docs = app?.required_documents?.length ? app.required_documents.map((doc) => [doc.document_type, doc.status, doc.uploaded_at]) : [["Ownership Deed", "verified", "2025-06-18"], ["ID Copy", "verified", "2025-06-18"], ["Contract", "pending", "2025-06-18"]];
  return <div className="s2-doc-list">{docs.map((d) => <div key={d[0]}><strong>{labelText(d[0])}<small>uploaded on {formatDate(d[2])}</small></strong><span className={`s2-badge ${badgeTone(d[1])}`}>{d[1]}</span></div>)}</div>;
}

function normalizeDocuments(app) {
  const docs = app?.required_documents?.length ? app.required_documents : app?.documents || [];
  if (docs.length) {
    return docs.map((doc, index) => ({
      key: `${doc.document_type}-${index}`,
      title: documentTitle(doc.document_type),
      fileName: doc.file_name || `${doc.document_type || "document"}.pdf`,
      size: doc.file_size || "1.2 MB",
      date: shortHumanDate(doc.uploaded_at || app?.created_at),
      status: doc.status === "pending_review" ? "pending" : (doc.status || "pending"),
    }));
  }
  return [
    { key: "emirates-id", title: "Emirates ID Copy", fileName: "emirates-id-copy.pdf", size: "1.2 MB", date: "20 May 2024", status: "verified" },
    { key: "title-deed", title: "Title Deed", fileName: "title-deed.pdf", size: "2.4 MB", date: "20 May 2024", status: "verified" },
    { key: "site-plan", title: "Site Plan", fileName: "site-plan.jpg", size: "1.8 MB", date: "20 May 2024", status: "pending" },
  ];
}

function DocumentRow({ doc }) {
  const verified = doc.status === "verified" || doc.status === "uploaded";
  const rejected = doc.status === "rejected";
  return (
    <div className="s2-uploaded-row">
      <div><strong>{doc.title}</strong><span>{doc.fileName} · {doc.size}</span><small>{doc.date}</small></div>
      <b className={rejected ? "rejected" : verified ? "verified" : "pending"}>{verified ? "✓ Verified" : rejected ? "✕ Rejected" : "◷ Pending"}</b>
    </div>
  );
}

export function Student2CommentsPage() {
  const [apps, setApps] = useState([]);
  const [selected, setSelected] = useState("");
  const [comment, setComment] = useState("Please find attached the requested document.");
  const [message, setMessage] = useState("");
  useEffect(() => { loadStudent2Applications({ limit: 20 }).then((data) => { const rows = itemsOf(data); setApps(rows); setSelected(rows[0]?.application_id || ""); }); }, []);
  async function submit(e) {
    e.preventDefault();
    if (!selected) {
      setMessage("Choose an application first.");
      return;
    }
    await postJson(`/applications/${selected}/comments`, { comment, actor: { role: userSession().role, id: userSession().linkedId } });
    setMessage("Comment submitted and logged.");
  }
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
  useEffect(() => { loadStudent2Applications({ limit: 20 }).then((data) => { const rows = itemsOf(data); setApps(rows); setSelected(rows[0]?.application_id || ""); }); }, []);
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

function LegacyStudent2TrackPage() {
  const { id } = useParams();
  const [app, setApp] = useState(null);
  const [events, setEvents] = useState([]);
  const [comment, setComment] = useState("Please update me when the next workflow step is completed.");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!id) return;
    Promise.all([
      api(`/applications/${id}`).catch(() => null),
      getTimeline(id).catch(() => ({ event_stream: [] })),
    ]).then(([application, timeline]) => {
      setApp(application);
      setEvents(timeline.event_stream || []);
    });
  }, [id]);
  async function addComment() {
    await postJson(`/applications/${id}/comments`, { comment, actor: { role: userSession().role, id: userSession().linkedId || "student2" } });
    setMessage("Comment added to the application timeline.");
    const timeline = await getTimeline(id).catch(() => ({ event_stream: [] }));
    setEvents(timeline.event_stream || []);
  }
  const parcel = app?.parcel_ref || {};
  const docs = normalizeDocuments(app);
  const objections = app?.objections || [];
  return (
    <section className="s2-track-page">
      <header className="s2-track-header">
        <div><span>Track Application (Details)</span><h1>Application ID: {id}</h1></div>
        <div className="s2-track-status"><small>Current Status</small><b className={`s2-mini-status ${workflowStatusTone(app?.status)}`}>{workflowStatusLabel(app?.status)}</b></div>
      </header>
      {message && <div className="s2-success">{message}</div>}
      <div className="s2-track-overview-card">
        <aside className="s2-track-side-tabs"><button type="button">Applicant</button><button type="button">My Applications</button><button type="button" className="active">My Documents</button><button type="button">My Objections</button></aside>
        <section className="s2-track-main-info">
          <nav><button type="button" className="active">Overview</button><button type="button">Timeline</button><button type="button">Documents</button><button type="button">Comments</button><button type="button">Objections</button></nav>
          <div className="s2-track-overview-body">
            <article>
              <h2>Application Details</h2>
              <dl className="s2-track-dl"><dt>Type</dt><dd>{labelText(app?.type)}</dd><dt>Submitted On</dt><dd>{shortHumanDate(app?.created_at || app?.submitted_at)}</dd><dt>Applicant</dt><dd>{app?.applicant_ref?.full_name || app?.applicant_ref?.name || "Applicant"}</dd><dt>Parcel No.</dt><dd>{parcel.parcel_number || "-"}</dd><dt>Area</dt><dd>{parcel.area_sqm || "-"} m²</dd><dt>Current Officer</dt><dd>Fatima Hassan</dd></dl>
            </article>
            <article>
              <h2>Parcel Location</h2>
              <div className="s2-track-map"><div className="parcel-shape" /></div>
              <Link to="#" onClick={(event) => event.preventDefault()}>View on Map</Link>
            </article>
          </div>
        </section>
      </div>
      <div className="s2-track-grid">
        <section className="s2-card span-2">
          <h2>Timeline</h2>
          <Timeline events={events} />
        </section>
        <section className="s2-card">
          <h2>Documents</h2>
          <div className="s2-track-list">{docs.map((doc) => <p key={doc.key}><span>{doc.title}</span><b className={doc.status}>{doc.status}</b></p>)}</div>
        </section>
        <section className="s2-card">
          <h2>Comments / Responses</h2>
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} />
          <button type="button" onClick={addComment}>Add Comment</button>
        </section>
        <section className="s2-card">
          <h2>Objections</h2>
          <div className="s2-track-list">{objections.length ? objections.map((item, index) => <p key={index}><span>{item.reason}</span><b>{item.status || "under_review"}</b></p>) : <p><span>No objections submitted</span><b>clear</b></p>}</div>
        </section>
      </div>
    </section>
  );
}

export function Student2TrackPage({ tab = "overview" }) {
  const { id } = useParams();
  const [app, setApp] = useState(null);
  const [events, setEvents] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [comments, setComments] = useState([]);
  const [objections, setObjections] = useState([]);
  const [comment, setComment] = useState("");
  const [objectionReason, setObjectionReason] = useState("");
  const [objectionFile, setObjectionFile] = useState(null);
  const [documentType, setDocumentType] = useState("ownership_deed");
  const [documentFile, setDocumentFile] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const basePath = `/student2/applications/${id}`;
  const tabs = [
    ["overview", "Overview", basePath],
    ["timeline", "Timeline", `${basePath}/timeline`],
    ["documents", "Documents", `${basePath}/documents`],
    ["comments", "Comments", `${basePath}/comments`],
    ["objections", "Objections", `${basePath}/objections`],
  ];

  async function load() {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const [application, timeline, documentData, commentData, objectionData] = await Promise.all([
        api(`/applications/${id}`),
        getTimeline(id),
        getApplicationDocuments(id),
        getApplicationComments(id),
        getApplicationObjections(id),
      ]);
      setApp(application);
      setEvents(timeline.event_stream || []);
      setDocuments(itemsOf(documentData));
      setComments(itemsOf(commentData));
      setObjections(itemsOf(objectionData));
    } catch (err) {
      setError(err.response?.data?.detail || "Could not load application tracking data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function addComment(event) {
    event.preventDefault();
    if (!comment.trim()) {
      setError("Write a comment before sending.");
      return;
    }
    try {
      await postJson(`/applications/${id}/comments`, {
        comment: comment.trim(),
        actor: { role: userSession().role, id: userSession().linkedId || "student2" },
      });
      setComment("");
      setMessage("Comment sent successfully.");
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || "Comment could not be sent.");
    }
  }

  async function uploadDocument(event) {
    event.preventDefault();
    if (!documentFile) {
      setError("Choose a file first.");
      return;
    }
    const formData = new FormData();
    formData.append("document_type", documentType);
    formData.append("file", documentFile);
    formData.append("file_size", String(documentFile.size));
    formData.append("status", "pending_review");
    try {
      await api(`/applications/${id}/documents`, {
        method: "POST",
        data: formData,
        headers: { "Content-Type": "multipart/form-data" },
      });
      setDocumentFile(null);
      setMessage("Document uploaded and sent for review.");
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || "Document upload failed.");
    }
  }

  async function submitObjection(event) {
    event.preventDefault();
    if (!objectionReason.trim()) {
      setError("Enter the objection reason.");
      return;
    }
    try {
      await postJson(`/applications/${id}/objections`, {
        reason: objectionReason.trim(),
        details: objectionReason.trim(),
        submitted_by: { role: userSession().role, id: userSession().linkedId || "student2" },
        supporting_documents: objectionFile ? [{
          file_name: objectionFile.name,
          file_url: `/local-upload/${objectionFile.name}`,
        }] : [],
      });
      setObjectionReason("");
      setObjectionFile(null);
      setMessage("Objection submitted successfully.");
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || "Objection could not be submitted.");
    }
  }

  const parcel = app?.parcel_ref || {};
  const shownDocuments = documents.length ? documents : normalizeDocuments(app);

  return (
    <section className="s2-track-page">
      <header className="s2-track-header">
        <div><span>Track Application (Details)</span><h1>Application ID: {id}</h1></div>
        <div className="s2-track-status"><small>Current Status</small><b className={`s2-mini-status ${workflowStatusTone(app?.status)}`}>{workflowStatusLabel(app?.status)}</b></div>
      </header>
      {message && <div className="s2-success">{message}</div>}
      {error && <div className="s2-error">{error}</div>}
      {loading && <div className="s2-card">Loading application data...</div>}
      {!loading && app && <div className="s2-track-overview-card">
        <aside className="s2-track-side-tabs">
          <Link to="/student2/profile">Applicant</Link>
          <Link to="/student2/applications">My Applications</Link>
          <Link className={tab === "documents" ? "active" : ""} to={`${basePath}/documents`}>My Documents</Link>
          <Link className={tab === "objections" ? "active" : ""} to={`${basePath}/objections`}>My Objections</Link>
        </aside>
        <section className="s2-track-main-info">
          <nav>{tabs.map(([key, label, path]) => <NavLink key={key} className={tab === key ? "active" : ""} to={path}>{label}</NavLink>)}</nav>

          {tab === "overview" && <div className="s2-track-overview-body">
            <article>
              <h2>Application Details</h2>
              <dl className="s2-track-dl">
                <dt>Type</dt><dd>{labelText(app.type)}</dd>
                <dt>Submitted On</dt><dd>{shortHumanDate(app.created_at || app.submitted_at)}</dd>
                <dt>Applicant</dt><dd>{app.applicant_ref?.full_name || app.applicant_ref?.name || "Applicant"}</dd>
                <dt>Parcel No.</dt><dd>{parcel.parcel_number || "-"}</dd>
                <dt>Area</dt><dd>{parcel.area_sqm || "-"} m2</dd>
                <dt>Current Officer</dt><dd>{app.assignment?.assigned_registrar || "Not assigned"}</dd>
              </dl>
            </article>
            <article>
              <h2>Parcel Location</h2>
              <div className="s2-track-map"><div className="parcel-shape" /></div>
              <span className="s2-map-caption">{parcel.zone_id || "No zone"} - {parcel.parcel_number || "No parcel"}</span>
            </article>
          </div>}

          {tab === "timeline" && <section className="s2-track-tab-panel">
            <h2>Application Timeline</h2>
            <p className="s2-muted">Every workflow event is loaded from performance logs.</p>
            <Timeline events={events} />
          </section>}

          {tab === "documents" && <section className="s2-track-tab-panel">
            <div className="s2-panel-title"><h2>Application Documents</h2><span>{shownDocuments.length} files</span></div>
            <div className="s2-document-table">
              {shownDocuments.length ? shownDocuments.map((doc, index) => {
                const fileName = doc.file_name || doc.fileName || "Not uploaded";
                const fileUrl = doc.file_url || doc.fileUrl;
                return <div key={doc._id || `${doc.document_type || doc.key}-${index}`}>
                  <strong>{labelText(doc.document_type || doc.title || doc.key)}</strong>
                  <span>{fileName}</span>
                  <b className={`s2-badge ${badgeTone(doc.status)}`}>{doc.status || "pending"}</b>
                  <span className="s2-document-actions">
                    {fileUrl ? <a href={fileUrl} target="_blank" rel="noreferrer">View</a> : <button type="button" disabled>View</button>}
                    {fileUrl ? <a href={fileUrl} download={fileName}>Download</a> : <button type="button" disabled>Download</button>}
                  </span>
                </div>;
              }) : <div className="s2-empty-state">No documents uploaded yet.</div>}
            </div>
            <form className="s2-track-form" onSubmit={uploadDocument}>
              <label>Document Type<select value={documentType} onChange={(event) => setDocumentType(event.target.value)}><option value="id_copy">ID Copy</option><option value="ownership_deed">Ownership Deed</option><option value="sale_contract">Contract</option><option value="parcel_map">Parcel Map</option><option value="supporting_document">Supporting Document</option></select></label>
              <label>Upload New Document<input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setDocumentFile(event.target.files?.[0] || null)} /></label>
              <button type="submit">Upload Document</button>
            </form>
          </section>}

          {tab === "comments" && <section className="s2-track-tab-panel">
            <h2>Comments / Responses</h2>
            <div className="s2-comments-thread">
              {comments.length ? comments.map((item, index) => <article key={item._id || index} className={item.actor?.role === "staff" ? "staff" : "applicant"}>
                <header><strong>{item.actor?.role === "staff" ? "Registrar" : "Applicant"}</strong><time>{formatDate(item.created_at)}</time></header>
                <p>{item.comment}</p>
              </article>) : <div className="s2-empty-state">No comments yet.</div>}
            </div>
            <form className="s2-track-form" onSubmit={addComment}>
              <label>Write Comment<textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Write your response..." /></label>
              <button type="submit">Send Comment</button>
            </form>
          </section>}

          {tab === "objections" && <section className="s2-track-tab-panel">
            <h2>Official Objections</h2>
            <div className="s2-objection-list">
              {objections.length ? objections.map((item) => <article key={item._id || item.objection_id}>
                <div><strong>{item.objection_id}</strong><span>{item.reason}</span></div>
                <div><b className={`s2-badge ${badgeTone(item.status)}`}>{item.status || "submitted"}</b><small>{formatDate(item.created_at)}</small></div>
              </article>) : <div className="s2-empty-state">No objections submitted.</div>}
            </div>
            <form className="s2-track-form" onSubmit={submitObjection}>
              <label>Objection Reason<textarea value={objectionReason} onChange={(event) => setObjectionReason(event.target.value)} placeholder="Explain the official reason for your objection..." /></label>
              <label>Supporting Document<input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setObjectionFile(event.target.files?.[0] || null)} /></label>
              <button type="submit" className="danger">Submit Objection</button>
            </form>
          </section>}
        </section>
      </div>}
    </section>
  );
}

export function Student2NotificationsPage() {
  const [notes, setNotes] = useState([]);
  useEffect(() => { getNotifications().then((data) => setNotes(itemsOf(data))).catch(() => setNotes([])); }, []);
  return <section className="s2-card s2-full"><h2>Notifications</h2><NotificationsMini notes={notes} /></section>;
}

export function Student2StaffConsolePage() {
  const [apps, setApps] = useState([]);
  const [filters, setFilters] = useState({ status: "", type: "", zone: "", date: "", applicant: "", parcel: "", search: "" });
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

function shortDate(value) {
  if (!value) return "--";
  const date = new Date(value);
  return date.toString() === "Invalid Date" ? value : date.toISOString().slice(0, 10);
}

function shortHumanDate(value) {
  if (!value) return "20 May 2024";
  const date = new Date(value);
  if (date.toString() === "Invalid Date") return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatFileSize(bytes) {
  if (!bytes) return "0 MB";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb >= 1 ? 1 : 2)} MB`;
}

function documentTitle(value) {
  return {
    id_copy: "Emirates ID Copy",
    ownership_deed: "Title Deed",
    sale_contract: "Sale Contract",
    site_plan: "Site Plan",
    parcel_map: "Site Plan",
    power_of_attorney: "Power of Attorney",
    survey_report: "Survey Report",
  }[value] || labelText(value);
}

function requiredDocumentsForType(type) {
  return {
    first_registration: ["id_copy", "proof_of_ownership", "parcel_map"],
    ownership_transfer: ["id_copy", "ownership_deed", "sale_contract"],
    parcel_subdivision: ["id_copy", "ownership_deed", "subdivision_plan", "survey_report"],
    parcel_merge: ["id_copy", "ownership_deed", "merge_plan", "survey_report"],
    boundary_correction: ["id_copy", "ownership_deed", "boundary_correction_request", "survey_report"],
    certificate_request: ["id_copy", "parcel_reference", "proof_of_ownership"],
  }[type] || ["id_copy", "ownership_deed"];
}

function labelText(value) {
  return String(value || "-").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function student2StatusLabel(status) {
  return {
    submitted: "In Review",
    pre_checked: "Shortlisted",
    survey_required: "Interview",
    surveyed: "In Review",
    legal_review: "In Review",
    approved: "Accepted",
    certificate_issued: "Accepted",
    closed: "Accepted",
    rejected: "Rejected",
    missing_documents: "In Review",
    under_objection: "Interview",
  }[status] || "No Status Yet";
}

function workflowStatusLabel(status) {
  if (["approved", "certificate_issued", "closed"].includes(status)) return "Completed";
  if (["pre_checked", "legal_review"].includes(status)) return "Under Review";
  if (!status) return "No Status";
  return "In Progress";
}

function workflowStatusTone(status) {
  if (["approved", "certificate_issued", "closed"].includes(status)) return "completed";
  if (["pre_checked", "legal_review"].includes(status)) return "review";
  if (!status) return "none";
  return "progress";
}

function statusTone(status) {
  if (["approved", "certificate_issued", "closed"].includes(status)) return "accepted";
  if (status === "rejected") return "rejected";
  if (["pre_checked"].includes(status)) return "shortlisted";
  if (["survey_required", "under_objection"].includes(status)) return "interview";
  if (!status) return "none";
  return "review";
}

function normalizeLanguage(value) {
  if (String(value).toLowerCase().startsWith("ar")) return "ar";
  return "en";
}

function initials(name) {
  return String(name || "Applicant")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "AP";
}

function loadStudent2Applications(params = {}) {
  const session = userSession();
  if (session.role === "applicant" && session.linkedId) {
    return getApplicantApplications(session.linkedId);
  }
  return getApplications(params);
}

function filterApplications(apps, filters = {}) {
  const search = (filters.search || "").toLowerCase().trim();
  const applicantSearch = (filters.applicant || "").toLowerCase().trim();
  const parcelSearch = (filters.parcel || "").toLowerCase().trim();
  return apps.filter((app) => {
    const parcel = app.parcel_ref || {};
    const applicant = app.applicant_ref || {};
    const matchesStatus = !filters.status || app.status === filters.status;
    const matchesType = !filters.type || app.type === filters.type;
    const matchesZone = !filters.zone || parcel.zone_id === filters.zone || parcel.zone === filters.zone;
    const dateValue = app.created_at || app.submitted_at || app.submitted_date;
    const matchesDate = !filters.date || (dateValue && formatDate(dateValue).includes(filters.date));
    const matchesApplicant = !applicantSearch || String(applicant.full_name || applicant.name || "").toLowerCase().includes(applicantSearch);
    const matchesParcel = !parcelSearch || String(parcel.parcel_number || app.parcel_number || "").toLowerCase().includes(parcelSearch);
    const haystack = [app.application_id, app.type, app.status, parcel.parcel_number, parcel.zone_id, applicant.full_name, app.parcel_number].filter(Boolean).join(" ").toLowerCase();
    const matchesSearch = !search || haystack.includes(search);
    return matchesStatus && matchesType && matchesZone && matchesDate && matchesApplicant && matchesParcel && matchesSearch;
  });
}
