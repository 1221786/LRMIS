import React from "react";
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

const states = ["submitted", "pre_checked", "survey_required", "legal_review", "approved", "certificate_issued", "closed"];
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

function SidebarSection({ title, items }) {
  return (
    <div className="s1-side-section">
      <strong>{title}</strong>
      {items.map((item, index) => (
        <button className={index === 0 && title === "MAIN" ? "active" : ""} key={item.label}>
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

export default function Student1Dashboard() {
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
        <section className="s1-kpis">
          <KpiCard icon={FileText} label="Total Applications" value="1,246" trend="+18 this month" tone="blue" />
          <KpiCard icon={Clock} label="Pending / In Progress" value="512" trend="+7%" tone="orange" />
          <KpiCard icon={AlertCircle} label="Under Objection" value="66" trend="+4%" tone="red" />
          <KpiCard icon={CheckCircle2} label="Approved" value="248" trend="+12%" tone="green" />
          <KpiCard icon={FileCheck2} label="Certificates Issued" value="86" trend="+6%" tone="purple" />
        </section>
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
