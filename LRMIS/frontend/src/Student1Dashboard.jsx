import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Archive,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Database,
  Download,
  Edit3,
  FileCheck2,
  FileText,
  Filter,
  FolderOpen,
  Gauge,
  Layers,
  LockKeyhole,
  MapPinned,
  MessageSquareText,
  MoreHorizontal,
  NotebookTabs,
  Printer,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Upload,
  User,
  XCircle,
} from "lucide-react";
import {
  api,
  getApplication,
  getApplications,
  getCertificates,
  getLogs,
  getObjections,
  getTimeline,
  patchJson,
  postJson,
} from "./api/client";

const states = ["submitted", "pre_checked", "survey_required", "surveyed", "legal_review", "approved", "certificate_issued", "closed"];
const applications = [
  ["LRMIS-2025-0001", "First Registration", "Nour Ahmad", "145 / b-06", "submitted", "2025-06-10"],
  ["LRMIS-2025-0002", "Ownership Transfer", "Ahmed Khalil", "146 / b-06", "survey_required", "2025-06-17"],
  ["LRMIS-2025-0003", "Parcel Subdivision", "Omar Saeed", "147 / b-07", "under_objection", "2025-06-16"],
  ["LRMIS-2025-0004", "Certificate Request", "Sara Ali", "148 / b-08", "approved", "2025-06-18"],
  ["LRMIS-2025-0005", "Boundary Correction", "Hassan M.", "149 / b-09", "pre_checked", "2025-06-19"],
];

function NumberBadge({ n }) {
  return <span className="s1-number">{n}</span>;
}

function StatusPill({ children, tone = "blue" }) {
  return <span className={`s1-pill ${tone}`}>{children}</span>;
}

function ModuleCard({ n, title, className = "", children, action }) {
  return (
    <section className={`s1-card ${className}`}>
      <header className="s1-card-head">
        <div><NumberBadge n={n} /><b>{title}</b></div>
        {action || <MoreHorizontal size={16} />}
      </header>
      {children}
    </section>
  );
}

function SidebarSection({ title, items, activePath = "", onNavigate }) {
  return (
    <div className="s1-side-section">
      <strong>{title}</strong>
      {items.map((item, index) => (
        <button className={activePath === item.path ? "active" : ""} key={item.label} onClick={() => onNavigate?.(item.path)}>
          <item.icon size={14} />
          <span>{item.label}</span>
          {item.badge && <em>{item.badge}</em>}
        </button>
      ))}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, trend, tone }) {
  return (
    <div className={`s1-kpi ${tone}`}>
      <span><Icon size={22} /></span>
      <div>
        <small>{label}</small>
        <b>{value}</b>
        <em>{trend}</em>
      </div>
    </div>
  );
}

function ApplicantStatCard({ icon: Icon, label, value, tone, onClick }) {
  return (
    <article className={`s1-applicant-stat ${tone}`}>
      <div><span><Icon size={19} /></span><small>{label}</small></div>
      <strong>{value}</strong>
      <button type="button" onClick={onClick}>View All</button>
    </article>
  );
}

function MiniMap() {
  return (
    <div className="s1-map-preview">
      <div className="s1-map-tools"><button>+</button><button>-</button></div>
      <div className="s1-polygon"><MapPinned size={18} /></div>
      <div className="s1-layers">
        <b>Layers</b>
        {["Parcels", "Blocks", "Zones", "Basins", "Satellite", "Roads"].map((x, i) => <label key={x}><input type="checkbox" defaultChecked={i !== 1} /> {x}</label>)}
      </div>
      <button className="s1-map-open">Open / Edit</button>
    </div>
  );
}

function WorkflowOverview() {
  return (
    <section className="s1-card s1-workflow-overview">
      <h3>WORKFLOW OVERVIEW (State Machine)</h3>
      <div className="s1-flow">
        {states.map((state, index) => (
          <React.Fragment key={state}>
            <div className={index > 3 ? "done" : index === 2 ? "warn" : ""}><span>{index + 1}</span><small>{state}</small></div>
            {index < states.length - 1 && <ChevronRight size={17} />}
          </React.Fragment>
        ))}
      </div>
      <div className="s1-alt-states">
        <StatusPill tone="red">rejected</StatusPill>
        <StatusPill tone="orange">on_hold</StatusPill>
        <StatusPill tone="orange">missing_documents</StatusPill>
        <StatusPill tone="purple">under_objection</StatusPill>
      </div>
      <p>Demo integration with Student 2 & 3 <CheckCircle2 size={14} /></p>
    </section>
  );
}

function SubmitCard() {
  return (
    <ModuleCard n="1" title="Submit Land Application" className="span-2 s1-submit">
      <div className="s1-wizard">
        {["Type", "Applicant", "Parcel Info", "Map / GeoJSON", "Documents", "Documents", "Review"].map((x, i) => <span className={i < 4 ? "active" : ""} key={x + i}><b>{i + 1}</b>{x}</span>)}
      </div>
      <div className="s1-submit-grid">
        <div className="s1-form">
          <label>Parcel Location (Select on Map)<select><option>First Registration</option><option>Ownership Transfer</option><option>Parcel Subdivision</option><option>Parcel Merge</option><option>Boundary Correction</option><option>Certificate Request</option></select></label>
          <h4>Applicant Information</h4>
          <label>Full Name *<input defaultValue="Nour Ahmad" /></label>
          <label>National ID / Passport *<input defaultValue="987654321" /></label>
          <label>Phone *<input defaultValue="+970 77 166 4687" /></label>
          <label>Email *<input defaultValue="nour.ahmad@example.com" /></label>
          <h4>Parcel Information</h4>
          <div className="s1-mini-fields">
            <label>Parcel No.<input defaultValue="145" /></label>
            <label>Block No.<input defaultValue="B-06" /></label>
            <label>Basin No.<input defaultValue="RM-01" /></label>
            <label>Zone<input defaultValue="RM-01" /></label>
            <label>Area m2<input defaultValue="600.75" /></label>
            <label>Ownership<input defaultValue="100%" /></label>
          </div>
          <label>Application Type<select><option>First Registration</option></select></label>
          <label>Notes<input defaultValue="Please register the parcel under my name" /></label>
        </div>
        <div>
          <MiniMap />
          <div className="s1-geo">
            <b>GeoJSON Preview</b>
            <pre>{'{\n  "type": "Polygon",\n  "coordinates": [...]\n}'}</pre>
          </div>
          <div className="s1-docs">
            <b>Uploaded Documents (3)</b>
            {["Site Plan.pdf|Pending|orange", "Property Deed.pdf|Under Review|orange", "ID Copy.pdf|Approved|green"].map((row) => {
              const [name, status, tone] = row.split("|");
              return <p key={name}><FileText size={14} /> {name} <StatusPill tone={tone}>{status}</StatusPill><XCircle size={13} /></p>;
            })}
          </div>
          <div className="s1-actions"><button>Save Draft</button><button className="primary">Next Step</button></div>
        </div>
      </div>
      <div className="s1-warning"><AlertCircle size={15} /> Missing required fields: Ownership Deed, Tax Clearance Certificate <span /> Invalid parcel number format</div>
    </ModuleCard>
  );
}

function ConfirmationCard() {
  return (
    <ModuleCard n="2" title="Application Confirmation" className="s1-confirm">
      <CheckCircle2 className="s1-big-check" size={64} />
      <h3>Application Submitted Successfully!</h3>
      <div className="s1-id">LRMIS-2025-0002</div>
      <p>Status: <StatusPill>submitted</StatusPill></p>
      <dl>
        <dt>Submitted Date</dt><dd>2025-06-10 10:30 AM</dd>
        <dt>Application Type</dt><dd>First Registration</dd>
        <dt>Parcel Number</dt><dd>145 [block: 8-06, basin: RM-01]</dd>
        <dt>Estimated Next Step</dt><dd>Pre-check by Registrar</dd>
      </dl>
      <div className="s1-idem"><b>Idempotency Key Format Example:</b><br />IDEMP-LRMIS-XXXX</div>
      <div className="s1-actions"><button><Printer size={14} /> Print Receipt</button><button><Download size={14} /> Download PDF</button></div>
    </ModuleCard>
  );
}

function TrackCard() {
  const events = [
    ["Application Submitted", "2025-06-10 10:30 AM", "by Applicant", "green"],
    ["Pre-check Started", "2025-06-10 11:20 AM", "by Registrar", "purple"],
    ["Missing Documents Requested", "2025-06-10 12:00 PM", "by Registrar", "red"],
    ["Documents Uploaded", "2025-06-10 2:15 PM", "by Applicant", "green"],
    ["Pre-check Completed", "2025-06-10 4:45 PM", "by Registrar", "blue"],
    ["Survey Required", "2025-06-11 9:05 PM", "by System", "orange"],
  ];
  return (
    <ModuleCard n="3" title="Track Application" className="span-2">
      <div className="s1-search"><input placeholder="Enter Application ID (e.g., LRMIS-2025-0001)" /><button>Search</button></div>
      <div className="s1-tabs"><b>Timeline</b><span>Documents</span><span>Notes</span><span>Survey</span><span>Objections</span></div>
      <div className="s1-track-grid">
        <div className="s1-track-line">
          {events.map((event) => <div className={event[3]} key={event[0]}><i /><b>{event[0]}</b><small>{event[1]}<br />{event[2]}</small></div>)}
        </div>
        <aside className="s1-track-side">
          <p>Current Status <StatusPill tone="orange">survey_required</StatusPill></p>
          <p><b>Next Step</b> Survey Assignment</p>
          <p><b>Assigned To</b> Eng. Bilal Ahmad</p>
          <p><b>Zone</b> RM-01</p>
          <p><b>Parcel Area</b> 600.75 m2</p>
          <p><b className="danger">Documents Missing</b> <StatusPill tone="red">1 item</StatusPill></p>
          <p><b>Registrar Note</b> Please upload site plan.</p>
          <a>View All Notes -&gt;</a>
        </aside>
      </div>
      <div className="s1-actions right"><button>Upload Additional Docs</button><button className="danger">Submit Objection</button></div>
    </ModuleCard>
  );
}

function SmallCards() {
  return (
    <>
      <ModuleCard n="4" title="Upload Additional Documents">
        <div className="s1-upload"><Upload size={30} /><b>Drag & drop files here</b><span>or</span><a>Choose Files</a></div>
        <label>Document Type<select><option>Site Plan</option></select></label>
        <label>Description (optional)<input defaultValue="Site plan for parcel" /></label>
        <div className="s1-doc-chip">Site Plan.pdf <StatusPill tone="orange">Pending</StatusPill></div>
        <div className="s1-doc-chip">Boundary Certificate <StatusPill tone="orange">Under Review</StatusPill></div>
        <div className="s1-doc-chip">Utility Bill.pdf <StatusPill tone="green">Approved</StatusPill></div>
        <button className="s1-full-btn">Upload</button>
      </ModuleCard>
      <ModuleCard n="5" title="Manual Registrar Decisions (Demo)">
        <p>Application ID: LRMIS-2025-0002<br />Current State: <StatusPill tone="orange">survey_required</StatusPill></p>
        <div className="s1-decision-buttons"><button>Approve</button><button>Reject</button><button>Hold</button><button>Request More Documents</button></div>
        <label>Rejection Reason<select><option>Select reason</option></select></label>
        <label>Notes optional<input placeholder="Add registrar notes..." /></label>
        <button className="s1-full-btn">Submit Decision</button>
      </ModuleCard>
      <ModuleCard n="6" title="Change Workflow State (Transition)">
        <p>Current Status: <StatusPill tone="orange">survey_required</StatusPill></p>
        <label>Next State<select>{["surveyed", "legal_review", "missing_documents", "under_objection", "rejected", "approved"].map(x => <option key={x}>{x}</option>)}</select></label>
        <ul className="s1-check-list">
          {["Only valid transitions are allowed.", "All required documents must be uploaded.", "Registrar decision is required.", "Reason is required for rejection or hold."].map(x => <li key={x}><Check size={14} />{x}</li>)}
        </ul>
        <button className="s1-full-btn">Transition</button>
      </ModuleCard>
      <ModuleCard n="7" title="Validation Rules (Business Rules)">
        <ul className="s1-rule-list">
          {["Only valid app_status transitions allowed", "Applicant's parcel is valid", "Survey certificate / report data approved", "Ownership documents uploaded", "Registrar decision exists", "Cannot issue certificate unless application approved"].map(x => <li key={x}><CheckCircle2 size={15} />{x}<ChevronRight size={14} /></li>)}
        </ul>
        <button className="s1-link-btn">View All Rules -&gt;</button>
      </ModuleCard>
    </>
  );
}

function ApplicationList() {
  return (
    <ModuleCard n="8" title="Application List (All Applications)" className="span-2">
      <div className="s1-filter-row"><button>All Status</button><button>All Types</button><button>All Zones</button><button>Date Range</button><button>More Filters</button><button><SlidersHorizontal size={14} /> Columns</button></div>
      <table className="s1-table"><thead><tr><th /><th>ID</th><th>Type</th><th>Applicant</th><th>Parcel No.</th><th>Status</th><th>Submitted At</th><th>Actions</th></tr></thead>
        <tbody>{applications.map((row) => <tr key={row[0]}><td><input type="checkbox" /></td><td>{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td><td>{row[3]}</td><td><StatusPill tone={row[4] === "approved" ? "green" : row[4] === "under_objection" ? "red" : row[4] === "survey_required" ? "orange" : row[4] === "pre_checked" ? "teal" : "blue"}>{row[4]}</StatusPill></td><td>{row[5]}</td><td><Edit3 size={14} /><Trash2 size={14} /></td></tr>)}</tbody>
      </table>
      <div className="s1-table-foot">Showing 1 to 5 of 124 applications <span>Prev 1 2 3 ... 250 Next</span></div>
      <div className="s1-actions"><button>View Application</button><button>Edit</button><button>Archive</button><button className="danger">Delete Application</button></div>
    </ModuleCard>
  );
}

function LogsAndCertificates() {
  const logs = [
    ["2025-06-10 10:30 AM", "LRMIS-0005-0002", "submitted", "Applicant", "Application submitted"],
    ["2025-06-10 11:20 AM", "LRMIS-0005-0002", "pre_check_started", "Registrar", "Pre-check started"],
    ["2025-06-10 02:00 PM", "LRMIS-0005-0002", "missing_documents", "Registrar", "Requested missing deed"],
    ["2025-06-10 03:15 PM", "LRMIS-0005-0002", "documents_uploaded", "Applicant", "Uploaded 2 documents"],
    ["2025-06-10 04:45 PM", "LRMIS-0005-0002", "pre_check_completed", "Registrar", "Pre-check completed"],
    ["2025-06-11 09:05 PM", "LRMIS-0005-0002", "survey_required", "System", "Sent to survey stage"],
  ];
  return (
    <>
      <ModuleCard n="9" title="Performance Logs (Events / Audit Trail)" className="span-2">
        <table className="s1-table compact"><thead><tr><th>Date & Time</th><th>Application ID</th><th>Event</th><th>User</th><th>Details</th></tr></thead><tbody>{logs.map((r) => <tr key={r.join()}>{r.map((c) => <td key={c}>{c}</td>)}</tr>)}</tbody></table>
        <button className="s1-link-btn">View Full Audit Trail</button>
      </ModuleCard>
      <ModuleCard n="10" title="Certificates">
        <div className="s1-green-note">Only approved application can generate certificate</div>
        <table className="s1-table compact"><thead><tr><th>Certificate ID</th><th>Application ID</th><th>Status</th><th>Actions</th></tr></thead><tbody>{[["CERT-2025-0001", "LRMIS-2025-0004", "Issued"], ["CERT-2025-0002", "LRMIS-2025-0003", "Pending"], ["CERT-2025-0003", "LRMIS-2025-0006", "Draft"]].map(r => <tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td><td><StatusPill tone={r[2] === "Issued" ? "green" : "orange"}>{r[2]}</StatusPill></td><td><Edit3 size={13} /></td></tr>)}</tbody></table>
        <div className="s1-actions"><button>Preview</button><button>Print</button><button>Download</button></div>
      </ModuleCard>
    </>
  );
}

function BottomModules() {
  const endpoints = ["POST /applications/ - Create a new land application", "GET /applications/{id} - Get application details", "GET /applications/ - List applications with filter, pagination, sorting", "PATCH /applications/{id}/transition - Change workflow state", "POST /applications/{id}/hold - Put application on hold", "POST /applications/{id}/reject - Reject application", "POST /applications/{id}/certificate - Generate certificate after approval"];
  const collections = ["land_applications - Main application data", "parcels - Parcel & GeoJSON data", "application_documents - Documents & verification", "performance_logs - Events & audit trail", "certificates - Certificate metadata", "application_notes - Notes & registrar remarks"];
  const rules = ["Cannot move to pre_checked unless applicant & parcel information is complete", "Cannot move to survey_required unless parcel location is valid", "Cannot move to surveyed unless survey report exists", "Cannot move to legal_review unless ownership documents are uploaded", "Cannot move to approved unless legal review is completed", "Certificate can only be issued after approval", "Rejected application must include rejection reason", "Application with objection must move to under_objection"];
  return (
    <>
      <ModuleCard n="11" title="API Endpoints (Student 1 APIs)"><ul className="s1-endpoints">{endpoints.map((e) => <li key={e}><StatusPill tone={e.startsWith("GET") ? "blue" : e.startsWith("PATCH") ? "orange" : "green"}>{e.split(" ")[0]}</StatusPill>{e.replace(e.split(" ")[0], "")}</li>)}</ul><button className="s1-full-btn">View API Documentation</button></ModuleCard>
      <ModuleCard n="12" title="MongoDB Collections"><ul className="s1-collections-list">{collections.map(x => <li key={x}><Database size={15} />{x}</li>)}</ul><button className="s1-full-btn">View Schema</button></ModuleCard>
      <ModuleCard n="13" title="Business Rules (Validation)"><ul className="s1-check-list">{rules.map(x => <li key={x}><Check size={14} />{x}</li>)}</ul><button className="s1-full-btn">View All Rules</button></ModuleCard>
      <ModuleCard n="14" title="Idempotency & Duplicate Prevention">
        <p><b>Idempotency Key</b><br />IDEMP-LRMIS-2025-4KTTX</p><p>Status <StatusPill tone="green">Processed</StatusPill></p><p>Created At: 2025-06-10 10:30 AM</p>
        {["Prevent Duplicate Submission", "Unique Parcel + Applicant Check", "Log Duplicates in performance_logs"].map(x => <div className="s1-toggle" key={x}><span>{x}</span><b /></div>)}
        <button className="s1-full-btn">View Logs</button>
      </ModuleCard>
      <ModuleCard n="15" title="Map & GeoJSON">
        <div className="s1-small-map"><div className="s1-pin" /><div className="s1-small-poly" /></div>
        <div className="s1-map-buttons"><button>Select Parcel on Map</button><button>Draw / Edit Boundary</button></div>
        <div className="s1-green-note">GeoJSON Valid</div><p>SRID: 4326 (WGS84)</p><button className="s1-full-btn">Open Map</button>
      </ModuleCard>
    </>
  );
}

function LegacyStudent1Dashboard() {
  const side = [
    ["MAIN", [["Dashboard", Gauge], ["My Applications", FolderOpen], ["Search & Filter", Search], ["Calendar & Schedule", CalendarDays]]],
    ["WORKFLOW", [["Transitions", SlidersHorizontal], ["Workflow Rules", ShieldCheck]]],
    ["DOCUMENTS", [["Manage Documents", FileText], ["Verification Status", ClipboardCheck]]],
    ["DECISIONS (REGISTRAR)", [["Manual Decisions", NotebookTabs, "Demo"], ["Registrar Notes", MessageSquareText, "Demo"]]],
    ["OBJECTIONS", [["Manage Objections", AlertCircle]]],
    ["CERTIFICATES", [["Generate Certificate", FileCheck2], ["Certificate List", Archive]]],
    ["REPORTS & LOGS", [["Performance Logs", Clock], ["Audit Trail", BookOpen], ["Reports & Analytics", Gauge]]],
    ["SETTINGS", [["Application Types", Layers], ["Idempotency Fields", LockKeyhole], ["System Settings", SlidersHorizontal], ["Audit Logs", Database]]],
  ];
  return (
    <div className="s1-shell">
      <aside className="s1-sidebar">
        <div className="s1-logo"><ShieldCheck size={36} /><div><b>LRMIS</b><small>Land Registration<br />Management Information System</small></div></div>
        {side.map(([title, items]) => <SidebarSection key={title} title={title} items={items.map(([label, icon, badge]) => ({ label, icon, badge }))} />)}
        <div className="s1-mongo"><b>MongoDB Collections</b>{["land_applications", "parcels", "application_documents", "performance_logs", "certificates", "application_notes"].map(x => <p key={x}><Check size={13} />{x}<span /></p>)}</div>
      </aside>
      <main className="s1-main">
        <header className="s1-top">
          <div className="s1-title"><h1>STUDENT 1 - LAND APPLICATION MANAGEMENT MODULE</h1><h2>(Applicant + Workflow Engine)</h2><span>Student 1 Core Module (Applicant + Workflow Engine)</span></div>
          <div className="s1-top-actions"><small>Beta</small><button>Applicant View</button><button>Registrar View (Demo)</button><div className="s1-bell"><Bell size={20} /><i>3</i></div><div className="s1-profile"><User size={28} /><b>Omar Hassan</b><small>Applicant</small></div><p>June 10, 2026<br /><b>10:30 AM</b></p></div>
        </header>
        {page === "dashboard" && <section className="s1-kpis">
          <KpiCard icon={FileText} label="Total Applications" value="1,246" trend="+18 this month" tone="blue" />
          <KpiCard icon={Clock} label="Pending / In Progress" value="512" trend="+7%" tone="orange" />
          <KpiCard icon={AlertCircle} label="Under Objection" value="66" trend="+4%" tone="red" />
          <KpiCard icon={CheckCircle2} label="Approved" value="248" trend="+12%" tone="green" />
          <KpiCard icon={FileCheck2} label="Certificates Issued" value="86" trend="+6%" tone="purple" />
        </section>}
        <WorkflowOverview />
        <section className="s1-grid">
          <SubmitCard />
          <ConfirmationCard />
          <TrackCard />
          <SmallCards />
          <ApplicationList />
          <LogsAndCertificates />
          <BottomModules />
        </section>
        <footer className="s1-footer">
          {["Smart Auto Assignment", "Real-time Milestone Tracking", "Live Geo Map", "Survey Reports", "Registrar Review", "Analytics & Insights", "Access Control", "Audit & Traceable", "GeoJSON Support"].map(x => <span key={x}><CheckCircle2 size={18} />{x}</span>)}
          <b>MODULE COMPLETE <CheckCircle2 size={24} /></b>
        </footer>
      </main>
    </div>
  );
}

function toneForStatus(status) {
  if (["approved", "certificate_issued", "closed"].includes(status)) return "green";
  if (["rejected", "under_objection"].includes(status)) return "red";
  if (["survey_required", "missing_documents", "on_hold"].includes(status)) return "orange";
  if (["pre_checked", "surveyed", "legal_review"].includes(status)) return "purple";
  return "blue";
}

function eventRows(logs) {
  return logs.flatMap((log) =>
    (log.event_stream || []).map((event) => ({
      id: `${log._id}-${event.at}-${event.type}`,
      applicationId: log.application_number || log.application_id,
      ...event,
    })),
  ).sort((a, b) => new Date(b.at) - new Date(a.at));
}

export default function Student1Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const page = location.pathname.split("/")[2] || "dashboard";
  const applicantPortalPages = ["applicant-dashboard", "submit", "confirmation", "track", "upload", "submit-objection"];
  const isApplicantPortal = applicantPortalPages.includes(page);
  const [apps, setApps] = useState([]);
  const [logs, setLogs] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [objections, setObjections] = useState([]);
  const [selected, setSelected] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [filters, setFilters] = useState({ status: "", type: "", zone: "", search: "" });
  const [transitionTarget, setTransitionTarget] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [createForm, setCreateForm] = useState({
    type: "ownership_transfer",
    full_name: "",
    national_id: "",
    phone: "",
    email: "",
    address: "",
    parcel_number: "",
    block_number: "",
    basin_number: "",
    zone_id: "ZONE-RM-01",
    area_sqm: "600",
    ownership_deed: null,
    id_copy: null,
    sale_contract: null,
  });
  const [portalDocument, setPortalDocument] = useState({ type: "ownership_deed", file: null });
  const [portalObjection, setPortalObjection] = useState({ reason: "", file: null });
  const [trackId, setTrackId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadDashboard() {
    setLoading(true);
    setError("");
    try {
      const [applicationData, logData, certificateData, objectionData] = await Promise.all([
        getApplications({ limit: 100, sort_by: "created_at", sort_dir: "desc" }),
        getLogs(),
        getCertificates(),
        getObjections(),
      ]);
      setApps(applicationData.items || []);
      setLogs(logData.items || []);
      setCertificates(certificateData.items || []);
      setObjections(objectionData.items || []);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not load Student 1 data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function openApplication(applicationId) {
    try {
      const [application, history] = await Promise.all([
        getApplication(applicationId),
        getTimeline(applicationId),
      ]);
      setSelected(application);
      setTimeline(history.event_stream || []);
      setTransitionTarget(application.workflow?.allowed_next?.[0] || "");
      setMessage("");
      setError("");
    } catch (err) {
      setError(err.response?.data?.detail || "Application details could not be loaded.");
    }
  }

  async function runAction(action) {
    if (!selected) {
      setError("Select an application from the table first.");
      return;
    }
    setError("");
    try {
      if (action === "transition") {
        await patchJson(`/applications/${selected.application_id}/transition`, {
          target_state: transitionTarget,
          note: note || `Registrar moved application to ${transitionTarget}`,
          actor: { role: "staff", id: localStorage.getItem("linked_id") },
        });
      } else if (action === "hold") {
        await postJson(`/applications/${selected.application_id}/hold`, {
          reason: reason || "Waiting for administrative verification",
          held_by: localStorage.getItem("linked_id"),
        });
      } else if (action === "reject") {
        if (reason.trim().length < 3) {
          setError("Rejection reason is required.");
          return;
        }
        await postJson(`/applications/${selected.application_id}/reject`, {
          reason,
          rejected_by: localStorage.getItem("linked_id"),
        });
      } else if (action === "certificate") {
        await postJson(`/applications/${selected.application_id}/certificate`, {
          issued_by: localStorage.getItem("linked_id") || "registrar",
        });
      } else if (action === "note") {
        await postJson(`/applications/${selected.application_id}/internal-notes`, {
          note: note || "Reviewed by registrar.",
          visible_to_applicant: true,
        });
      } else if (action === "missing") {
        const missing = (selected.required_documents || [])
          .filter((doc) => doc.status === "missing")
          .map((doc) => doc.document_type);
        await postJson(`/applications/${selected.application_id}/request-missing-documents`, {
          document_types: missing.length ? missing : ["ownership_deed"],
          note: note || "Please upload the required documents.",
        });
      } else if (action === "archive") {
        await api(`/applications/${selected.application_id}`, { method: "DELETE" });
      }
      setMessage(`Action "${action}" completed and logged.`);
      await loadDashboard();
      await openApplication(selected.application_id);
    } catch (err) {
      setError(err.response?.data?.detail || "The workflow engine rejected this action.");
    }
  }

  async function createApplication(event) {
    event.preventDefault();
    setError("");
    try {
      const key = `STAFF-${Date.now()}-${createForm.national_id}-${createForm.parcel_number}`;
      const created = await api("/applications/", {
        method: "POST",
        headers: { "Idempotency-Key": key },
        data: {
          type: createForm.type,
          priority: "normal",
          description: "Created from Student 1 registrar console",
          applicant: {
            full_name: createForm.full_name,
            national_id: createForm.national_id,
            contacts: { email: createForm.email, phone: createForm.phone },
            address: { city: createForm.address, street: createForm.address, zone_id: createForm.zone_id },
            type: "citizen",
          },
          parcel: {
            parcel_number: createForm.parcel_number,
            block_number: createForm.block_number,
            basin_number: createForm.basin_number,
            zone_id: createForm.zone_id,
            area_sqm: Number(createForm.area_sqm),
            geometry: {
              type: "Polygon",
              coordinates: [[[35.2, 31.9], [35.201, 31.9], [35.201, 31.901], [35.2, 31.9]]],
            },
          },
          documents: [
            createForm.ownership_deed && { document_type: "ownership_deed", file_name: createForm.ownership_deed.name, file_url: `/local-upload/${createForm.ownership_deed.name}`, status: "pending_review" },
            createForm.id_copy && { document_type: "id_copy", file_name: createForm.id_copy.name, file_url: `/local-upload/${createForm.id_copy.name}`, status: "pending_review" },
            createForm.sale_contract && { document_type: "sale_contract", file_name: createForm.sale_contract.name, file_url: `/local-upload/${createForm.sale_contract.name}`, status: "pending_review" },
          ].filter(Boolean),
        },
      });
      setMessage(`Application ${created.application_id} created with status submitted.`);
      await loadDashboard();
      await openApplication(created.application_id);
      navigate("/student1/confirmation");
    } catch (err) {
      setError(err.response?.data?.detail || "Application creation failed. Complete all required fields.");
    }
  }

  async function trackApplication(event) {
    event.preventDefault();
    if (!trackId.trim()) return setError("Enter an application ID.");
    await openApplication(trackId.trim());
  }

  async function uploadPortalDocument(event) {
    event.preventDefault();
    if (!selected || !portalDocument.file) return setError("Select an application and choose a file.");
    const formData = new FormData();
    formData.append("document_type", portalDocument.type);
    formData.append("file", portalDocument.file);
    formData.append("file_size", String(portalDocument.file.size));
    formData.append("status", "pending_review");
    try {
      await api(`/applications/${selected.application_id}/documents`, {
        method: "POST",
        data: formData,
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage("Document uploaded successfully and sent for review.");
      await openApplication(selected.application_id);
    } catch (err) {
      setError(err.response?.data?.detail || "Document upload failed.");
    }
  }

  async function submitPortalObjection(event) {
    event.preventDefault();
    if (!selected || portalObjection.reason.trim().length < 5) return setError("Select an application and enter a clear objection reason.");
    try {
      await postJson(`/applications/${selected.application_id}/objections`, {
        reason: portalObjection.reason.trim(),
        submitted_by: { role: "staff", id: localStorage.getItem("linked_id") },
        supporting_documents: portalObjection.file ? [{
          file_name: portalObjection.file.name,
          file_url: `/local-upload/${portalObjection.file.name}`,
        }] : [],
      });
      setMessage("Objection submitted successfully.");
      await loadDashboard();
      await openApplication(selected.application_id);
    } catch (err) {
      setError(err.response?.data?.detail || "Objection submission failed.");
    }
  }

  async function reviewDocument(documentType, decision) {
    if (!selected) return setError("Select an application first.");
    try {
      await patchJson(`/applications/${selected.application_id}/documents/review`, {
        document_type: documentType,
        decision,
        rejection_reason: decision === "rejected" ? reason || "Document needs correction" : null,
      });
      setMessage(`Document ${documentType} marked ${decision}.`);
      await openApplication(selected.application_id);
    } catch (err) {
      setError(err.response?.data?.detail || "Document review failed.");
    }
  }

  async function reviewObjection(objectionId, status) {
    try {
      await patchJson(`/objections/${objectionId}`, {
        status,
        registrar_response: note || `Objection marked ${status}`,
        resolution_note: note,
      });
      setMessage(`Objection ${objectionId} updated.`);
      await loadDashboard();
    } catch (err) {
      setError(err.response?.data?.detail || "Objection update failed.");
    }
  }

  function signOut() {
    localStorage.clear();
    navigate("/login");
  }

  const filtered = useMemo(() => apps.filter((app) => {
    const text = `${app.application_id} ${app.applicant_ref?.full_name || ""} ${app.parcel_ref?.parcel_number || ""}`.toLowerCase();
    return (!filters.status || app.status === filters.status)
      && (!filters.type || app.type === filters.type)
      && (!filters.zone || app.parcel_ref?.zone_id === filters.zone)
      && (!filters.search || text.includes(filters.search.toLowerCase()));
  }), [apps, filters]);

  const counts = {
    total: apps.length,
    pending: apps.filter((app) => !["closed", "rejected", "certificate_issued"].includes(app.status)).length,
    objections: apps.filter((app) => app.status === "under_objection").length,
    approved: apps.filter((app) => app.status === "approved").length,
    certificates: certificates.length,
    rejected: apps.filter((app) => app.status === "rejected").length,
  };
  const recentEvents = eventRows(logs).slice(0, 12);

  return (
    <div className={`s1-shell ${isApplicantPortal ? "s1-applicant-mode" : ""}`}>
      <aside className="s1-sidebar">
        <div className="s1-logo"><ShieldCheck size={36} /><div><b>LRMIS</b><small>{isApplicantPortal ? "Applicant Portal" : <>Land Registration<br />Management Information System</>}</small></div></div>
        {isApplicantPortal ? <>
        <SidebarSection title="APPLICANT PORTAL" activePath={page} onNavigate={(path) => navigate(`/student1/${path}`)} items={[
          { label: "Dashboard", icon: Gauge, path: "applicant-dashboard" },
          { label: "My Applications", icon: FolderOpen, path: "track" },
          { label: "New Application", icon: Edit3, path: "submit" },
          { label: "Documents", icon: FileText, path: "upload" },
          { label: "Objections", icon: AlertCircle, path: "submit-objection" },
          { label: "Profile", icon: User, path: "applicant-dashboard" },
          { label: "Notifications", icon: Bell, path: "applicant-dashboard" },
          { label: "Help & Support", icon: MessageSquareText, path: "applicant-dashboard" },
        ]} />
        <button className="s1-logout" type="button" onClick={signOut}><LockKeyhole size={14} />Logout</button>
        </> : <>
        <SidebarSection title="MAIN" activePath={page} onNavigate={(path) => navigate(`/student1/${path}`)} items={[
          { label: "Dashboard", icon: Gauge, path: "dashboard" },
          { label: "Applications", icon: FolderOpen, path: "applications" },
          { label: "Workflow & Transitions", icon: SlidersHorizontal, path: "workflow" },
          { label: "Documents", icon: FileText, path: "documents" },
        ]} />
        <SidebarSection title="REGISTRAR" activePath={page} onNavigate={(path) => navigate(`/student1/${path}`)} items={[
          { label: "Manual Decisions", icon: NotebookTabs, path: "decisions" },
          { label: "Objections", icon: AlertCircle, path: "objections" },
          { label: "Certificates", icon: FileCheck2, path: "certificates" },
          { label: "Audit Logs", icon: Clock, path: "logs" },
          { label: "System Rules", icon: ShieldCheck, path: "settings" },
        ]} />
        <div className="s1-mongo"><b>MongoDB Collections</b>{["land_applications", "parcels", "performance_logs", "certificates"].map((name) => <p key={name}><Check size={13} />{name}<span /></p>)}</div>
        </>}
        <div className="s1-applicant-profile"><User size={30} /><div><b>{localStorage.getItem("full_name") || "Applicant User"}</b><small>{isApplicantPortal ? "Individual" : "Registrar"}</small></div></div>
      </aside>

      <main className="s1-main">
        {!isApplicantPortal && <header className="s1-top">
          <div className="s1-title"><h1>{["applicant-dashboard", "submit", "confirmation", "track", "upload", "submit-objection"].includes(page) ? "LRMIS APPLICANT PORTAL" : "STUDENT 1 - LAND APPLICATION MANAGEMENT MODULE"}</h1><h2>{["applicant-dashboard", "submit", "confirmation", "track", "upload", "submit-objection"].includes(page) ? "Land Registration Services" : "Registrar + Workflow Engine"}</h2><span>FastAPI + MongoDB workflow system</span></div>
          <div className="s1-top-actions"><button onClick={loadDashboard}>Refresh</button><div className="s1-profile"><User size={28} /><b>{localStorage.getItem("full_name") || "Registrar"}</b><small>Staff / Registrar</small></div></div>
        </header>}

        {message && <div className="s1-green-note">{message}</div>}
        {error && <div className="s1-warning"><AlertCircle size={15} />{error}</div>}

        {page === "dashboard" && <section className="s1-kpis">
          <KpiCard icon={FileText} label="Total Applications" value={counts.total} trend="MongoDB live" tone="blue" />
          <KpiCard icon={Clock} label="Pending / In Progress" value={counts.pending} trend="Needs action" tone="orange" />
          <KpiCard icon={AlertCircle} label="Under Objection" value={counts.objections} trend="Formal objections" tone="red" />
          <KpiCard icon={CheckCircle2} label="Approved" value={counts.approved} trend="Ready for certificate" tone="green" />
          <KpiCard icon={FileCheck2} label="Certificates Issued" value={counts.certificates} trend="Generated records" tone="purple" />
        </section>}

        {page === "dashboard" && <WorkflowOverview />}

        <section className="s1-grid">
          {page === "applicant-dashboard" && <>
            <section className="s1-applicant-welcome span-2">
              <div><span>Welcome,</span><h2>{localStorage.getItem("full_name") || "Applicant User"}</h2><p>Manage your land registration applications</p></div>
              <div className="s1-welcome-icons"><Bell size={20} /><User size={20} /></div>
            </section>
            <section className="s1-applicant-stats span-2">
              <ApplicantStatCard icon={FileText} label="Total Applications" value={apps.length} tone="blue" onClick={() => navigate("/student1/track")} />
              <ApplicantStatCard icon={Clock} label="In Progress" value={counts.pending} tone="orange" onClick={() => { setFilters({ ...filters, status: "submitted" }); navigate("/student1/track"); }} />
              <ApplicantStatCard icon={CheckCircle2} label="Approved" value={counts.approved} tone="green" onClick={() => { setFilters({ ...filters, status: "approved" }); navigate("/student1/track"); }} />
              <ApplicantStatCard icon={XCircle} label="Rejected" value={counts.rejected} tone="red" onClick={() => { setFilters({ ...filters, status: "rejected" }); navigate("/student1/track"); }} />
            </section>
            <section className="s1-recent-applications span-2">
              <div className="s1-recent-head"><h3>Recent Applications</h3><button onClick={() => navigate("/student1/track")}>View All</button></div>
              <table className="s1-table"><thead><tr><th>Application ID</th><th>Type</th><th>Parcel Number</th><th>Status</th><th>Submitted On</th></tr></thead><tbody>{apps.slice(0, 6).map((app) => <tr key={app._id} onClick={() => { setTrackId(app.application_id); openApplication(app.application_id); navigate("/student1/track"); }}><td>{app.application_id}</td><td>{app.type?.replaceAll("_", " ")}</td><td>{app.parcel_ref?.parcel_number}</td><td><StatusPill tone={toneForStatus(app.status)}>{app.status}</StatusPill></td><td>{new Date(app.created_at).toLocaleDateString()}</td></tr>)}</tbody></table>
              <div className="s1-new-application-row"><button className="s1-portal-primary" onClick={() => navigate("/student1/submit")}><Edit3 size={17} /> Submit New Application</button></div>
            </section>
          </>}

          {page === "submit" && <section className="s1-portal-page span-2">
            <header className="s1-portal-heading"><div><span><Edit3 size={20} /></span><div><h2>Submit Land Application</h2><p>Create a complete land registration request</p></div></div><b>Applicant Portal</b></header>
            <div className="s1-portal-steps">{["Application Type", "Applicant Info", "Parcel Details", "Location & Documents", "Submit"].map((label, index) => <div className={index === 0 ? "active" : ""} key={label}><i>{index + 1}</i><span>{label}</span></div>)}</div>
            <form className="s1-portal-form" onSubmit={createApplication}>
              <section>
                <h3>Application Information</h3>
                <div className="s1-form-grid">
                  <label>Application Type<select value={createForm.type} onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}>{["ownership_transfer", "first_registration", "parcel_subdivision", "parcel_merge", "boundary_correction", "certificate_request"].map((value) => <option key={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
                  <label>Applicant Full Name<input required minLength="2" value={createForm.full_name} onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })} placeholder="Enter full legal name" /></label>
                  <label>National ID / Registration No.<input required minLength="5" value={createForm.national_id} onChange={(e) => setCreateForm({ ...createForm, national_id: e.target.value })} placeholder="National ID or company number" /></label>
                  <label>Phone<input required value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} placeholder="+970..." /></label>
                  <label>Email<input required type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} placeholder="name@example.com" /></label>
                  <label>Address<input required value={createForm.address} onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })} placeholder="City, street, neighborhood" /></label>
                </div>
              </section>
              <section>
                <h3>Parcel Information</h3>
                <div className="s1-form-grid four">
                  <label>Parcel Number<input required value={createForm.parcel_number} onChange={(e) => setCreateForm({ ...createForm, parcel_number: e.target.value })} /></label>
                  <label>Block Number<input required value={createForm.block_number} onChange={(e) => setCreateForm({ ...createForm, block_number: e.target.value })} /></label>
                  <label>Basin Number<input required value={createForm.basin_number} onChange={(e) => setCreateForm({ ...createForm, basin_number: e.target.value })} /></label>
                  <label>Zone<input required value={createForm.zone_id} onChange={(e) => setCreateForm({ ...createForm, zone_id: e.target.value })} /></label>
                  <label>Area (m2)<input required type="number" min="1" value={createForm.area_sqm} onChange={(e) => setCreateForm({ ...createForm, area_sqm: e.target.value })} /></label>
                </div>
              </section>
              <section className="s1-location-section">
                <div><h3>Parcel Location</h3><p>The parcel is stored as a valid GeoJSON Polygon.</p><div className="s1-portal-map"><div className="s1-polygon"><MapPinned size={22} /></div><span>GeoJSON Polygon - WGS84</span></div></div>
                <div>
                  <h3>Required Documents</h3>
                  <div className="s1-submit-doc-inputs">
                    <label>ID Copy<input required type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setCreateForm({ ...createForm, id_copy: e.target.files?.[0] || null })} /></label>
                    <label>Ownership Deed<input required type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setCreateForm({ ...createForm, ownership_deed: e.target.files?.[0] || null })} /></label>
                    {createForm.type === "ownership_transfer" && <label>Sale Contract<input required type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setCreateForm({ ...createForm, sale_contract: e.target.files?.[0] || null })} /></label>}
                    <div className="s1-required-list">
                      {[["ID Copy", createForm.id_copy], ["Ownership Deed", createForm.ownership_deed], ["Sale Contract", createForm.sale_contract]]
                        .filter(([name]) => name !== "Sale Contract" || createForm.type === "ownership_transfer")
                        .map(([name, file]) => <p key={name}><FileText size={16} /><span>{name}</span><StatusPill tone={file ? "green" : "orange"}>{file ? "Selected" : "Required"}</StatusPill></p>)}
                    </div>
                  </div>
                </div>
              </section>
              <footer><p><ShieldCheck size={17} /> Duplicate submissions are prevented using an Idempotency-Key.</p><button className="s1-portal-primary" type="submit">Submit Application <ChevronRight size={18} /></button></footer>
            </form>
          </section>}

          {page === "confirmation" && <section className="s1-portal-page s1-confirmation-page span-2">
            <CheckCircle2 size={72} />
            <h2>Application Submitted Successfully</h2>
            {selected ? <><div className="s1-confirm-id">{selected.application_id}</div><div className="s1-confirm-summary"><p><span>Current Status</span><StatusPill tone={toneForStatus(selected.status)}>{selected.status}</StatusPill></p><p><span>Submitted Date</span><b>{new Date(selected.created_at).toLocaleString()}</b></p><p><span>Next Step</span><b>{selected.workflow?.allowed_next?.[0] || "Completed"}</b></p><p><span>Parcel</span><b>{selected.parcel_ref?.parcel_number} / {selected.parcel_ref?.zone_id}</b></p></div><div className="s1-portal-map compact"><div className="s1-polygon"><MapPinned size={22} /></div></div><div className="s1-actions"><button onClick={() => { setTrackId(selected.application_id); navigate("/student1/track"); }}>View Application</button><button className="primary" onClick={() => navigate("/student1/applicant-dashboard")}>Go to Dashboard</button></div></> : <><p>No recently submitted application selected.</p><button className="s1-portal-primary" onClick={() => navigate("/student1/submit")}>Create Application</button></>}
          </section>}

          {page === "track" && <section className="s1-portal-page span-2">
            <header className="s1-portal-heading"><div><span><Search size={20} /></span><div><h2>Track Application</h2><p>Follow every workflow event and required action</p></div></div></header>
            <form className="s1-track-search" onSubmit={trackApplication}><input value={trackId} onChange={(e) => setTrackId(e.target.value)} placeholder="Enter Application ID, e.g. LRMIS-2026-0001" /><button>Search</button></form>
            {selected ? <div className="s1-track-layout"><section><h3>Status Timeline</h3><div className="s1-track-line">{timeline.map((event, index) => <div className="green" key={`${event.at}-${index}`}><i /><b>{event.type.replaceAll("_", " ")}</b><small>{new Date(event.at).toLocaleString()}<br />by {event.by?.role || "system"}</small></div>)}</div></section><aside><h3>Application Summary</h3><p>Current Status <StatusPill tone={toneForStatus(selected.status)}>{selected.status}</StatusPill></p><p><b>Parcel</b>{selected.parcel_ref?.parcel_number} / {selected.parcel_ref?.zone_id}</p><p><b>Survey Status</b>{selected.survey_status || "not assigned"}</p><p><b>Missing Documents</b>{(selected.required_documents || []).filter((doc) => doc.status === "missing").length}</p><p><b>Registrar Notes</b>{(selected.visible_registrar_notes || []).map((item) => item.note || item.notes).join(", ") || "No visible notes"}</p><button onClick={() => navigate("/student1/upload")}>Upload Missing Documents</button></aside></div> : <div className="s1-empty-portal"><Search size={38} /><b>Search for an application to view its timeline</b></div>}
          </section>}

          {page === "upload" && <section className="s1-portal-page span-2">
            <header className="s1-portal-heading"><div><span><Upload size={20} /></span><div><h2>Upload Additional Documents</h2><p>Submit missing or replacement documents</p></div></div></header>
            <label className="s1-app-select">Application<select value={selected?.application_id || ""} onChange={(e) => openApplication(e.target.value)}><option value="">Select application</option>{apps.map((app) => <option key={app._id} value={app.application_id}>{app.application_id}</option>)}</select></label>
            <div className="s1-upload-layout"><form onSubmit={uploadPortalDocument}><label>Document Type<select value={portalDocument.type} onChange={(e) => setPortalDocument({ ...portalDocument, type: e.target.value })}><option value="id_copy">ID Copy</option><option value="ownership_deed">Ownership Deed</option><option value="sale_contract">Sale Contract</option><option value="parcel_map">Parcel Map</option><option value="supporting_document">Supporting Document</option></select></label><label className="s1-drop-zone"><Upload size={38} /><b>Choose file from your computer</b><span>PDF, JPG or PNG</span><input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setPortalDocument({ ...portalDocument, file: e.target.files?.[0] || null })} /></label><button className="s1-portal-primary">Upload Document</button></form><section><h3>Document Review Status</h3>{(selected?.required_documents || []).map((doc) => <div className="s1-document-row" key={doc.document_type}><div><b>{doc.document_type.replaceAll("_", " ")}</b><span>{doc.file_name || "Not uploaded"}</span></div><StatusPill tone={doc.status === "verified" ? "green" : doc.status === "rejected" ? "red" : "orange"}>{doc.status}</StatusPill></div>)}</section></div>
          </section>}

          {page === "submit-objection" && <section className="s1-portal-page span-2">
            <header className="s1-portal-heading"><div><span className="danger-icon"><AlertCircle size={20} /></span><div><h2>Submit Objection</h2><p>File a formal objection with supporting evidence</p></div></div></header>
            <div className="s1-objection-layout"><form onSubmit={submitPortalObjection}><label>Application<select value={selected?.application_id || ""} onChange={(e) => openApplication(e.target.value)}><option value="">Select application</option>{apps.map((app) => <option key={app._id} value={app.application_id}>{app.application_id}</option>)}</select></label><label>Objection Reason<textarea value={portalObjection.reason} onChange={(e) => setPortalObjection({ ...portalObjection, reason: e.target.value })} placeholder="Explain why you object to the decision or parcel details..." /></label><label>Supporting Document<input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setPortalObjection({ ...portalObjection, file: e.target.files?.[0] || null })} /></label><button className="s1-portal-primary danger">Submit Official Objection</button></form><section><h3>Objection Status</h3>{objections.filter((item) => !selected || item.application_id === selected._id).map((item) => <div className="s1-document-row" key={item._id}><div><b>{item.objection_id}</b><span>{item.reason}</span></div><StatusPill tone={item.status === "resolved" ? "green" : "orange"}>{item.status}</StatusPill></div>)}</section></div>
          </section>}

          {page === "dashboard" && <>
            <ModuleCard n="1" title="Recent Applications" className="span-2">
              <table className="s1-table"><thead><tr><th>ID</th><th>Applicant</th><th>Parcel</th><th>Status</th><th>Action</th></tr></thead><tbody>{apps.slice(0, 6).map((app) => <tr key={app._id}><td>{app.application_id}</td><td>{app.applicant_ref?.full_name}</td><td>{app.parcel_ref?.parcel_number}</td><td><StatusPill tone={toneForStatus(app.status)}>{app.status}</StatusPill></td><td><button onClick={() => { openApplication(app.application_id); navigate("/student1/applications"); }}>Open</button></td></tr>)}</tbody></table>
            </ModuleCard>
            <ModuleCard n="2" title="Quick Actions">
              <button className="s1-full-btn" onClick={() => navigate("/student1/applications")}>New / View Applications</button>
              <button className="s1-full-btn" onClick={() => navigate("/student1/workflow")}>Workflow Transitions</button>
              <button className="s1-full-btn" onClick={() => navigate("/student1/documents")}>Review Documents</button>
              <button className="s1-full-btn" onClick={() => navigate("/student1/certificates")}>Certificates</button>
            </ModuleCard>
          </>}

          {page === "applications" && <>
          <ModuleCard n="1" title="Create Land Application" className="span-2">
            <form className="s1-mini-fields" onSubmit={createApplication}>
              <label>Application Type<select value={createForm.type} onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}>{["ownership_transfer", "first_registration", "parcel_subdivision", "parcel_merge", "boundary_correction", "certificate_request"].map((value) => <option key={value}>{value}</option>)}</select></label>
              <label>Applicant Full Name<input required minLength="2" value={createForm.full_name} onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })} /></label>
              <label>National ID<input required minLength="5" value={createForm.national_id} onChange={(e) => setCreateForm({ ...createForm, national_id: e.target.value })} /></label>
              <label>Parcel Number<input required value={createForm.parcel_number} onChange={(e) => setCreateForm({ ...createForm, parcel_number: e.target.value })} /></label>
              <label>Block Number<input required value={createForm.block_number} onChange={(e) => setCreateForm({ ...createForm, block_number: e.target.value })} /></label>
              <label>Basin Number<input required value={createForm.basin_number} onChange={(e) => setCreateForm({ ...createForm, basin_number: e.target.value })} /></label>
              <label>Zone<input required value={createForm.zone_id} onChange={(e) => setCreateForm({ ...createForm, zone_id: e.target.value })} /></label>
              <button className="s1-full-btn" type="submit">Create Submitted Application</button>
            </form>
            <div className="s1-green-note">Uses a valid GeoJSON Polygon and a unique Idempotency-Key. Missing documents are tracked by the workflow engine.</div>
          </ModuleCard>

          <ModuleCard n="2" title="Application List (MongoDB)" className="span-2">
            <div className="s1-filter-row">
              <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All Statuses</option>{[...states, "rejected", "on_hold", "missing_documents", "under_objection"].map((value) => <option key={value}>{value}</option>)}</select>
              <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}><option value="">All Types</option>{["first_registration", "ownership_transfer", "parcel_subdivision", "parcel_merge", "boundary_correction", "certificate_request"].map((value) => <option key={value}>{value}</option>)}</select>
              <input value={filters.zone} onChange={(e) => setFilters({ ...filters, zone: e.target.value })} placeholder="Zone" />
              <input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Search ID, applicant, parcel" />
            </div>
            {loading ? <p>Loading applications...</p> : <table className="s1-table"><thead><tr><th>ID</th><th>Type</th><th>Applicant</th><th>Parcel</th><th>Zone</th><th>Status</th><th>Submitted</th><th>Action</th></tr></thead>
              <tbody>{filtered.map((app) => <tr key={app._id}><td>{app.application_id}</td><td>{app.type}</td><td>{app.applicant_ref?.full_name}</td><td>{app.parcel_ref?.parcel_number}</td><td>{app.parcel_ref?.zone_id}</td><td><StatusPill tone={toneForStatus(app.status)}>{app.status}</StatusPill></td><td>{new Date(app.created_at).toLocaleDateString()}</td><td><button onClick={() => openApplication(app.application_id)}>Open</button></td></tr>)}</tbody>
            </table>}
          </ModuleCard>

          <ModuleCard n="3" title="Application Details" className="span-2">
            {!selected ? <p>Select an application from the table.</p> : <>
              <div className="s1-track-grid">
                <dl className="s1-confirm">
                  <dt>Application ID</dt><dd>{selected.application_id}</dd>
                  <dt>Applicant</dt><dd>{selected.applicant_ref?.full_name}</dd>
                  <dt>Parcel</dt><dd>{selected.parcel_ref?.parcel_number} / {selected.parcel_ref?.zone_id}</dd>
                  <dt>Current Status</dt><dd><StatusPill tone={toneForStatus(selected.status)}>{selected.status}</StatusPill></dd>
                  <dt>Allowed Next</dt><dd>{(selected.workflow?.allowed_next || []).join(", ") || "Final state"}</dd>
                  <dt>Required Documents</dt><dd>{(selected.required_documents || []).map((doc) => `${doc.document_type}: ${doc.status}`).join(" | ")}</dd>
                </dl>
                <div className="s1-track-line">{timeline.length ? timeline.map((event, index) => <div className="green" key={`${event.at}-${index}`}><i /><b>{event.type}</b><small>{new Date(event.at).toLocaleString()}<br />{event.by?.role || "system"}</small></div>) : <p>No timeline events yet.</p>}</div>
              </div>
            </>}
          </ModuleCard>
          </>}

          {page === "workflow" && <>
          <ModuleCard n="1" title="Selected Application" className="span-2">
            <label>Application<select value={selected?.application_id || ""} onChange={(e) => openApplication(e.target.value)}><option value="">Select application</option>{apps.map((app) => <option key={app._id} value={app.application_id}>{app.application_id} - {app.status}</option>)}</select></label>
            {selected && <div className="s1-track-grid"><div><p><b>Applicant:</b> {selected.applicant_ref?.full_name}</p><p><b>Parcel:</b> {selected.parcel_ref?.parcel_number} / {selected.parcel_ref?.zone_id}</p><p><b>Status:</b> <StatusPill tone={toneForStatus(selected.status)}>{selected.status}</StatusPill></p></div><div className="s1-track-line">{timeline.map((event, index) => <div className="green" key={`${event.at}-${index}`}><i /><b>{event.type}</b><small>{new Date(event.at).toLocaleString()}</small></div>)}</div></div>}
          </ModuleCard>
          <ModuleCard n="4" title="Workflow State Machine">
            <label>Next State<select value={transitionTarget} onChange={(e) => setTransitionTarget(e.target.value)}><option value="">Select allowed state</option>{(selected?.workflow?.allowed_next || []).map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Registrar Note<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Decision or transition note" /></label>
            <button className="s1-full-btn" disabled={!selected || !transitionTarget} onClick={() => runAction("transition")}>Apply Valid Transition</button>
            <ul className="s1-check-list">{["Applicant and parcel completeness", "Valid GeoJSON before survey", "Survey report before surveyed", "Ownership documents before legal review", "Registrar review before approval"].map((rule) => <li key={rule}><Check size={14} />{rule}</li>)}</ul>
          </ModuleCard>
          <ModuleCard n="2" title="Strict Validation Rules">
            <ul className="s1-check-list">{["submitted → pre_checked requires applicant and parcel data", "pre_checked → survey_required requires valid GeoJSON", "survey_required → surveyed requires survey report", "surveyed → legal_review requires ownership documents", "legal_review → approved requires registrar review", "approved → certificate_issued only through certificate endpoint"].map((rule) => <li key={rule}><Check size={14} />{rule}</li>)}</ul>
          </ModuleCard>
          </>}

          {page === "decisions" && <>
          <ModuleCard n="1" title="Select Application" className="span-2"><label>Application<select value={selected?.application_id || ""} onChange={(e) => openApplication(e.target.value)}><option value="">Select application</option>{apps.map((app) => <option key={app._id} value={app.application_id}>{app.application_id} - {app.status}</option>)}</select></label></ModuleCard>
          <ModuleCard n="5" title="Registrar Decisions">
            <label>Mandatory Reason<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for rejection or hold" /></label>
            <div className="s1-decision-buttons">
              <button onClick={() => runAction("note")}>Save Note</button>
              <button onClick={() => runAction("missing")}>Request Documents</button>
              <button onClick={() => runAction("hold")}>Hold</button>
              <button className="danger" onClick={() => runAction("reject")}>Reject</button>
            </div>
            <button className="s1-full-btn" disabled={selected?.status !== "approved"} onClick={() => runAction("certificate")}>Generate Certificate</button>
            <button className="s1-link-btn" disabled={!selected} onClick={() => runAction("archive")}>Archive Application</button>
          </ModuleCard>
          <ModuleCard n="2" title="Decision Requirements">
            <ul className="s1-rule-list"><li><CheckCircle2 size={15} />Reject requires a mandatory reason.</li><li><CheckCircle2 size={15} />Hold requires an administrative reason.</li><li><CheckCircle2 size={15} />Notes are written to performance_logs.</li><li><CheckCircle2 size={15} />Certificate is enabled only after approval.</li></ul>
          </ModuleCard>
          </>}

          {page === "documents" && <>
          <ModuleCard n="1" title="Application Documents" className="span-2">
            <label>Application<select value={selected?.application_id || ""} onChange={(e) => openApplication(e.target.value)}><option value="">Select application</option>{apps.map((app) => <option key={app._id} value={app.application_id}>{app.application_id}</option>)}</select></label>
            <table className="s1-table"><thead><tr><th>Document</th><th>File</th><th>Status</th><th>Actions</th></tr></thead><tbody>{(selected?.required_documents || []).map((doc) => <tr key={doc.document_type}><td>{doc.document_type}</td><td>{doc.file_name || "Not uploaded"}</td><td><StatusPill tone={doc.status === "verified" ? "green" : doc.status === "rejected" ? "red" : "orange"}>{doc.status}</StatusPill></td><td><button disabled={!doc.file_name} onClick={() => reviewDocument(doc.document_type, "verified")}>Verify</button><button className="danger" disabled={!doc.file_name} onClick={() => reviewDocument(doc.document_type, "rejected")}>Reject</button></td></tr>)}</tbody></table>
            <label>Review / rejection note<input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
            <button className="s1-full-btn" disabled={!selected} onClick={() => runAction("missing")}>Request Missing Documents</button>
          </ModuleCard>
          </>}

          {page === "objections" && <ModuleCard n="1" title="Manage Objections" className="span-2">
            <label>Registrar Response<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Resolution note" /></label>
            <table className="s1-table"><thead><tr><th>ID</th><th>Application</th><th>Reason</th><th>Status</th><th>Submitted</th><th>Actions</th></tr></thead><tbody>{objections.map((item) => <tr key={item._id}><td>{item.objection_id}</td><td>{item.application_number || item.application_id}</td><td>{item.reason}</td><td><StatusPill tone={item.status === "resolved" || item.status === "accepted" ? "green" : item.status === "rejected" ? "red" : "orange"}>{item.status}</StatusPill></td><td>{item.created_at ? new Date(item.created_at).toLocaleDateString() : "-"}</td><td><button onClick={() => reviewObjection(item.objection_id, "under_review")}>Review</button><button onClick={() => reviewObjection(item.objection_id, "resolved")}>Resolve</button><button className="danger" onClick={() => reviewObjection(item.objection_id, "rejected")}>Reject</button></td></tr>)}</tbody></table>
          </ModuleCard>}

          {page === "logs" &&
          <ModuleCard n="6" title="Audit Trail / performance_logs" className="span-2">
            <table className="s1-table compact"><thead><tr><th>Date</th><th>Application</th><th>Event</th><th>Actor</th><th>Details</th></tr></thead><tbody>{recentEvents.map((event) => <tr key={event.id}><td>{new Date(event.at).toLocaleString()}</td><td>{event.applicationId}</td><td>{event.type}</td><td>{event.by?.role || "system"}</td><td>{JSON.stringify(event.metadata || {})}</td></tr>)}</tbody></table>
          </ModuleCard>
          }

          {page === "certificates" &&
          <ModuleCard n="7" title="Certificates" className="span-2">
            <label>Approved Application<select value={selected?.application_id || ""} onChange={(e) => openApplication(e.target.value)}><option value="">Select approved application</option>{apps.filter((app) => app.status === "approved").map((app) => <option key={app._id} value={app.application_id}>{app.application_id} - {app.applicant_ref?.full_name}</option>)}</select></label>
            <button className="s1-full-btn" disabled={selected?.status !== "approved"} onClick={() => runAction("certificate")}>Generate Certificate Metadata</button>
            <table className="s1-table compact"><thead><tr><th>Certificate ID</th><th>Application</th><th>Status</th><th>Issued At</th></tr></thead><tbody>{certificates.map((certificate) => <tr key={certificate._id}><td>{certificate.certificate_id}</td><td>{certificate.application_number || certificate.application_id}</td><td><StatusPill tone="green">{certificate.status}</StatusPill></td><td>{certificate.issued_at ? new Date(certificate.issued_at).toLocaleString() : "-"}</td></tr>)}</tbody></table>
          </ModuleCard>
          }

          {page === "settings" && <BottomModules />}
        </section>
      </main>
    </div>
  );
}
