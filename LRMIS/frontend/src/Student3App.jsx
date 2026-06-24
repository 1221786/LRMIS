import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import L from "leaflet";
import {
  api,
  getApplications,
  getByStatus,
  getByZone,
  getKpis,
  getLogs,
  getNotifications,
  getParcels,
  getPendingHeatmap,
  getProcessingTime,
  getSurveyors,
  getSurveyTasks,
  patchJson,
  postJson,
} from "./api/client";

const milestones = ["assigned", "visit_scheduled", "arrived_on_site", "survey_started", "survey_completed", "report_uploaded", "registrar_reviewed"];
const fallbackSurveyTasks = [
  { demo: true, task_id: "SVY-2026-101", application_number: "LRMIS-2026-0001", parcel_ref: { parcel_number: "145", zone_id: "ZONE-RM-01" }, priority: "High", status: "assigned", current_milestone: "assigned" },
  { demo: true, task_id: "SVY-2026-102", application_number: "LRMIS-2026-0002", parcel_ref: { parcel_number: "290", zone_id: "ZONE-RM-02" }, priority: "Medium", status: "visit_scheduled", current_milestone: "visit_scheduled" },
  { demo: true, task_id: "SVY-2026-103", application_number: "LRMIS-2026-0003", parcel_ref: { parcel_number: "88", zone_id: "ZONE-RM-03" }, priority: "High", status: "survey_started", current_milestone: "survey_started" },
];

function session() {
  return {
    fullName: localStorage.getItem("full_name") || "Hassan Surveyor",
    role: localStorage.getItem("role") || "surveyor",
  };
}

function itemsOf(data) {
  return Array.isArray(data) ? data : data?.items || [];
}

function statusTone(value = "") {
  if (["Completed", "survey_completed", "report_uploaded", "registrar_reviewed", "approved", "certificate_issued"].includes(value)) return "good";
  if (["In Progress", "visit_scheduled", "arrived_on_site", "survey_started", "survey_required", "pre_checked"].includes(value)) return "warn";
  if (["under_objection", "rejected", "disputed"].includes(value)) return "bad";
  return "info";
}

function backendMessage(err) {
  const detail = err.response?.data?.detail;
  if (Array.isArray(detail)) return detail.map((item) => item.msg || JSON.stringify(item)).join(", ");
  return detail || err.message || "Request failed.";
}

function taskApplicationId(task) {
  return task?.application_number || task?.application_id || "";
}

function readableMilestone(value = "") {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeMilestone(value = "") {
  const raw = `${value}`.trim();
  const normalized = raw.toLowerCase().replaceAll(" ", "_");
  const aliases = {
    "in_progress": "survey_started",
    "visit_scheduled": "visit_scheduled",
    "arrived_on_site": "arrived_on_site",
    "survey_started": "survey_started",
    "survey_completed": "survey_completed",
    "report_uploaded": "report_uploaded",
    "registrar_reviewed": "registrar_reviewed",
    "completed": "survey_completed",
    "assigned": "assigned",
  };
  return aliases[normalized] || normalized || "assigned";
}

function getAllowedAction(status) {
  const current = normalizeMilestone(status);
  return {
    assigned: "visit_scheduled",
    visit_scheduled: "arrived_on_site",
    arrived_on_site: "survey_started",
    survey_started: "survey_completed",
    survey_completed: "upload_report",
    report_uploaded: "field_notes",
    registrar_reviewed: "none",
  }[current] || "none";
}

function taskStatusGroup(task) {
  const status = normalizeMilestone(task?.current_milestone || task?.status || "assigned");
  if (["report_uploaded", "registrar_reviewed", "survey_completed"].includes(status)) return "Completed";
  if (["visit_scheduled", "arrived_on_site", "survey_started"].includes(status)) return "In Progress";
  return "Assigned";
}

function scheduledVisit(task) {
  return (task?.milestones || []).find((item) => item.milestone === "visit_scheduled")?.scheduled_date || "May 21, 2025";
}

function nextMilestone(current) {
  const index = milestones.indexOf(normalizeMilestone(current || "assigned"));
  return index >= 0 && index < milestones.length - 1 ? milestones[index + 1] : null;
}

function isRealSurveyTask(task) {
  return Boolean(task?._id && !task.demo);
}

export default function Student3App() {
  const user = session();
  const navigate = useNavigate();
  function signOut() {
    localStorage.clear();
    navigate("/login");
  }
  return (
    <div className="s3-shell">
      <aside className="s3-sidebar">
        <div className="s3-brand"><div className="s3-logo">LR</div><div><strong>LRMIS</strong><span>Land Registration Management Information System</span></div></div>
        <nav className="s3-nav">
          <NavGroup title="MAIN" items={[["Dashboard", "/student3/dashboard"], ["My Survey Tasks", "/student3/tasks"], ["Calendar & Schedule", "/student3/tasks"], ["Messages", "/student3/reports"]]} />
          <NavGroup title="FIELD OPERATIONS" items={[["Task Execution", "/student3/execution"], ["Field Notes", "/student3/execution"], ["Survey Reports", "/student3/reports"], ["Documents & Files", "/student3/reports"]]} />
          <NavGroup title="MAP & SPATIAL" items={[["Live Parcel Map", "/student3/map"], ["Parcel Search", "/student3/map"], ["Zones & Layers", "/student3/map"]]} />
          <NavGroup title="ANALYTICS & REPORTS" items={[["Analytics Dashboard", "/student3/analytics"], ["Reports", "/student3/reports"], ["Charts & Insights", "/student3/analytics"]]} />
          <NavGroup title="MANAGEMENT" items={[["Surveyors", "/student3/reports"], ["Workload Overview", "/student3/analytics"], ["Task Assignment", "/student3/tasks"]]} />
        </nav>
        <div className="s3-profile"><div>BA</div><strong>{user.fullName || "Eng. Bilal Ahmad"}</strong><span>Online</span><small>ID: SUR-2025-014</small><button type="button" onClick={signOut}>Logout</button></div>
      </aside>
      <main className="s3-main">
        <header className="s3-topbar">
          <div><h1>Student 3 - Surveyor, Map & Analytics Dashboard</h1><p>Surveyor Tasks + Geo Visualization + Spatial Insights + Performance Analytics</p></div>
          <div className="s3-top-actions"><label>Role<select><option>Surveyor</option><option>Registrar</option><option>Manager</option></select></label><span className="s3-bell">2</span><div className="s3-avatar">BA</div><div className="s3-user-block"><strong>{user.fullName || "Eng. Bilal Ahmad"}</strong><span>Surveyor · Online</span><small>{new Date().toLocaleDateString()} · {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></div></div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}

function NavGroup({ title, items }) {
  return <div className="s3-nav-group"><p>{title}</p>{items.map(([label, to]) => <NavLink to={to} key={`${title}-${label}`}>{label}</NavLink>)}</div>;
}

export function Student3Dashboard() {
  const [tasks, setTasks] = useState([]);
  const [kpis, setKpis] = useState(null);
  useEffect(() => {
    getSurveyTasks().then((data) => setTasks(itemsOf(data))).catch(() => setTasks([]));
    getKpis().then(setKpis).catch(() => setKpis(null));
  }, []);
  return (
    <div className="s3-stack">
      <Student3Kpis tasks={tasks} kpis={kpis} />
      <SurveyTasksPanel tasks={tasks} onRefresh={() => getSurveyTasks().then((data) => setTasks(itemsOf(data)))} />
    </div>
  );
}

function Student3Kpis({ tasks, kpis }) {
  const assigned = tasks.filter((task) => taskStatusGroup(task) === "Assigned").length;
  const inProgress = tasks.filter((task) => taskStatusGroup(task) === "In Progress").length;
  const completed = tasks.filter((task) => taskStatusGroup(task) === "Completed").length;
  const pendingReports = tasks.filter((task) => (task.current_milestone || task.status) === "survey_completed" && !task.report_uploaded).length;
  const cards = [
    ["Assigned Tasks", assigned || tasks.length || 18, "2 new today", "blue"],
    ["In Progress", inProgress || 7, "2 overdue", "orange"],
    ["Completed This Month", completed || 31, "+10% vs last month", "green"],
    ["Pending Reports", pendingReports || 4, "Need Upload", "purple"],
    ["Surveyor Workload", "78%", "This Week", "yellow"],
    ["Certificates Issued (May)", kpis?.certificates_issued ?? 22, "+10% vs last month", "cyan"],
  ];
  return <div className="s3-kpis">{cards.map((card) => <article className={`s3-kpi ${card[3]}`} key={card[0]}><strong>{card[0]}</strong><i>{card[1]}</i><span>{card[2]}</span></article>)}</div>;
}

function PanelTitle({ n, title, link }) {
  return <div className="s3-panel-title"><h2>{n && <b>{n}</b>}{title}</h2>{link && <Link to={link}>View All</Link>}</div>;
}

export function Student3TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [message, setMessage] = useState("");
  async function load() {
    const data = await getSurveyTasks();
    setTasks(itemsOf(data));
    setMessage("Survey tasks refreshed from MongoDB.");
  }
  useEffect(() => { load().catch(() => setTasks([])); }, []);
  return <div className="s3-stack"><Student3Kpis tasks={tasks} kpis={null} />{message && <div className="s3-success">{message}</div>}<SurveyTasksPanel tasks={tasks} onRefresh={load} full /></div>;
}

function SurveyTasksPanel({ tasks, onRefresh, full = true }) {
  const [tab, setTab] = useState("All");
  const [filters, setFilters] = useState({ zone: "", priority: "", milestone: "" });
  const filtered = tasks.filter((task) => {
    const group = taskStatusGroup(task);
    const milestone = task.current_milestone || task.status || "assigned";
    if (tab !== "All" && group !== tab && !(tab === "Pending Report" && milestone === "survey_completed" && !task.report_uploaded)) return false;
    if (filters.zone && !(task.zone_id || task.parcel_ref?.zone_id || "").includes(filters.zone)) return false;
    if (filters.priority && (task.priority || "").toLowerCase() !== filters.priority) return false;
    if (filters.milestone && milestone !== filters.milestone) return false;
    return true;
  });
  return (
    <section className="s3-card s3-page-card s3-task-focus">
      <div className="s3-task-head">
        <PanelTitle n="1" title="My Survey Tasks" />
        <div className="s3-toolbar"><button type="button" onClick={onRefresh}>Refresh</button><Link to="/student3/execution">Open Execution</Link><button type="button" className="secondary">Search</button><button type="button" className="secondary">Filter</button></div>
      </div>
      <div className="s3-tabs">{["All", "Assigned", "In Progress", "Completed", "Pending Report"].map((item) => <button type="button" className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item} ({item === "All" ? tasks.length : tasks.filter((task) => item === "Pending Report" ? (task.current_milestone || task.status) === "survey_completed" && !task.report_uploaded : taskStatusGroup(task) === item).length})</button>)}</div>
      <div className="s3-filter-row"><input placeholder="Zone" value={filters.zone} onChange={(event) => setFilters({ ...filters, zone: event.target.value })} /><select value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value })}><option value="">All Priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="normal">Normal</option><option value="low">Low</option></select><select value={filters.milestone} onChange={(event) => setFilters({ ...filters, milestone: event.target.value })}><option value="">All Milestones</option>{milestones.map((step) => <option key={step}>{step}</option>)}</select></div>
      <SurveyTaskTable tasks={filtered.length || tab !== "All" || filters.zone || filters.priority || filters.milestone ? filtered : tasks} full={full} />
    </section>
  );
}

function SurveyTaskTable({ tasks, full = false }) {
  const rows = tasks.length ? tasks : fallbackSurveyTasks;
  return (
    <table className="s3-table">
      <thead><tr><th>Task ID</th><th>Application ID</th><th>Parcel No.</th><th>Zone</th><th>Priority</th><th>Scheduled Visit</th><th>Current Milestone</th><th>Status</th>{full && <th>Actions</th>}</tr></thead>
      <tbody>{rows.map((task) => <tr key={task.task_id || task._id}><td>{task.task_id}</td><td>{task.application_number || task.application_id}</td><td>{task.parcel_number || task.parcel_ref?.parcel_number || "-"}</td><td>{task.zone_id || task.zone || task.parcel_ref?.zone_id || "-"}</td><td><span className={`s3-priority ${(task.priority || "normal").toLowerCase()}`}>{task.priority || "normal"}</span></td><td>{scheduledVisit(task)}</td><td>{readableMilestone(task.current_milestone || task.status)}</td><td><Badge value={taskStatusGroup(task)} /></td>{full && <td><div className="s3-row-actions"><Link title="View task" to={`/student3/execution/${task.application_number || task.application_id}`}>View</Link><Link title="Open execution" to={`/student3/execution/${task.application_number || task.application_id}`}>Open</Link><Link title="View parcel on map" to="/student3/map">Map</Link></div></td>}</tr>)}</tbody>
    </table>
  );
}

export function Student3ExecutionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [previewTasks, setPreviewTasks] = useState(fallbackSurveyTasks);
  const [selectedId, setSelectedId] = useState(id || "");
  const [notes, setNotes] = useState("Site visit completed. Boundary measured and verified with neighboring parcels.");
  const [fileName, setFileName] = useState("survey_report.pdf");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const taskPool = tasks.length ? [...tasks, ...previewTasks.filter((preview) => !tasks.some((item) => (item.application_number || item.application_id) === preview.application_number))] : previewTasks;
  const task = taskPool.find((item) => (item.application_number || item.application_id) === selectedId) || (!selectedId ? taskPool[0] : null);
  const realTask = isRealSurveyTask(task);

  async function load(routeApplicationId = id) {
    const data = await getSurveyTasks();
    const rows = itemsOf(data);
    setTasks(rows);
    setSelectedId(routeApplicationId || rows[0]?.application_number || rows[0]?.application_id || "");
  }
  useEffect(() => {
    setMessage("");
    setError("");
    setNotes("");
    setSelectedId(id || "");
    load(id).catch(() => setTasks([]));
  }, [id]);

  async function loadFieldNotes(applicationId) {
    if (!applicationId) return;
    try {
      const data = await api(`/applications/${applicationId}/survey-field-notes`);
      if (data.latest?.note) setNotes(data.latest.note);
    } catch (err) {
      setError(backendMessage(err));
    }
  }

  useEffect(() => {
    const applicationId = taskApplicationId(task);
    if (applicationId && realTask) {
      setNotes("");
      loadFieldNotes(applicationId);
    } else if (applicationId) {
      setNotes("");
      setError("");
    } else if (selectedId) {
      setNotes("");
      setError(`No survey task found for ${selectedId}.`);
    }
  }, [task?._id, task?.application_number, selectedId]);

  async function mark(milestone) {
    if (!task) return;
    const current = normalizeMilestone(task.current_milestone || task.status || "assigned");
    const allowedNext = nextMilestone(current);
    const applicationId = taskApplicationId(task);
    const payload = {
      milestone,
      scheduled_date: milestone === "visit_scheduled" ? "2026-06-25" : undefined,
      field_notes: notes,
      note: `Surveyor marked ${milestone}`,
      actor: { role: "surveyor", id: localStorage.getItem("linked_id") },
    };
    console.log(applicationId);
    console.log(payload);
    if (milestone !== current && milestone !== allowedNext) {
      setError(`Cannot move from ${current} to ${milestone}. Next allowed milestone is ${allowedNext || "none"}.`);
      setMessage("");
      return;
    }
    if (!realTask) {
      setPreviewTasks((currentTasks) => currentTasks.map((item) => (item.application_number === applicationId ? { ...item, current_milestone: milestone, status: milestone, milestones: [...(item.milestones || []), { milestone, at: new Date().toISOString(), notes: `Preview marked ${milestone}` }] } : item)));
      setError("");
      setMessage(`Preview milestone updated to ${readableMilestone(milestone)}.`);
      return;
    }
    try {
      setError("");
      await patchJson(`/applications/${applicationId}/survey-milestone`, payload);
      setMessage(milestone === current ? "Field notes saved." : `Milestone updated to ${milestone}.`);
      await load();
    } catch (err) {
      setMessage("");
      setError(backendMessage(err));
    }
  }

  async function uploadReport() {
    if (!task) return;
    if (normalizeMilestone(task.current_milestone || task.status) !== "survey_completed") {
      setMessage("");
      setError(`Cannot upload report while task is ${task.current_milestone || task.status}. Complete the survey first.`);
      return;
    }
    const applicationId = taskApplicationId(task);
    const payload = {
      report_type: "field_survey",
      file_name: fileName,
      file_url: `/uploads/${fileName}`,
      summary: notes,
      findings: { boundary_matches: true, measured_by: "GPS", dispute_found: false },
      attachments: [{ file_name: fileName, type: "survey_report" }],
      actor: { role: "surveyor", id: localStorage.getItem("linked_id") },
    };
    console.log(applicationId);
    console.log(payload);
    if (!realTask) {
      setPreviewTasks((currentTasks) => currentTasks.map((item) => (item.application_number === applicationId ? { ...item, current_milestone: "report_uploaded", status: "report_uploaded", report_uploaded: true, milestones: [...(item.milestones || []), { milestone: "report_uploaded", at: new Date().toISOString(), notes: "Preview report uploaded" }] } : item)));
      setError("");
      setMessage("Preview report metadata uploaded.");
      return;
    }
    try {
      setError("");
      await postJson(`/applications/${applicationId}/survey-report`, payload);
      setMessage("Survey report metadata uploaded and logged.");
      await load();
    } catch (err) {
      setMessage("");
      setError(backendMessage(err));
    }
  }

  async function saveFieldNotes() {
    if (!task) return;
    const applicationId = taskApplicationId(task);
    const payload = {
      note: notes,
      actor: { role: "surveyor", id: localStorage.getItem("linked_id") },
    };
    console.log(applicationId);
    console.log(payload);
    if (!realTask) {
      setPreviewTasks((currentTasks) => currentTasks.map((item) => (item.application_number === applicationId ? { ...item, field_notes: [...(item.field_notes || []), { note: notes, created_at: new Date().toISOString(), created_by: "preview" }] } : item)));
      setError("");
      setMessage("Preview field notes saved.");
      return;
    }
    try {
      setError("");
      const updatedTask = await postJson(`/applications/${applicationId}/survey-field-notes`, payload);
      setTasks((current) => current.map((item) => (item._id === updatedTask._id ? updatedTask : item)));
      await loadFieldNotes(applicationId);
      setMessage("Field notes saved to MongoDB.");
    } catch (err) {
      setMessage("");
      setError(backendMessage(err));
    }
  }

  const current = normalizeMilestone(task?.current_milestone || task?.status || "assigned");
  const allowedAction = getAllowedAction(current);
  const taskDetails = {
    applicationId: taskApplicationId(task) || selectedId || "No task selected",
    parcel: task ? task?.parcel_number || task?.parcel_ref?.parcel_number || "-" : "-",
    zone: task ? task?.zone_id || task?.parcel_ref?.zone_id || "-" : "-",
    area: task ? task?.parcel_ref?.area_sqm || task?.area_sqm || "860 m2" : "-",
    priority: task ? task?.priority || "High" : "-",
    due: task ? scheduledVisit(task) : "-",
    milestone: current,
  };

  return (
    <div className="s3-execution-page">
      <section className="s3-card s3-execution-main">
        <PanelTitle n="2" title="Survey Task Execution" />
        {message && <div className="s3-success">{message}</div>}
        {error && <div className="s3-error">{error}</div>}
        <label className="s3-label">Select Task<select value={selectedId} onChange={(e) => { setSelectedId(e.target.value); setMessage(""); setError(""); navigate(`/student3/execution/${e.target.value}`); }}>{taskPool.map((item) => <option key={item._id || item.task_id} value={item.application_number || item.application_id}>{item.task_id} - {item.application_number || item.application_id}</option>)}</select></label>
        <div className="s3-summary-grid">
          <article><span>Application ID</span><strong>{taskDetails.applicationId}</strong></article>
          <article><span>Parcel Number</span><strong>{taskDetails.parcel}</strong></article>
          <article><span>Zone</span><strong>{taskDetails.zone}</strong></article>
          <article><span>Area</span><strong>{taskDetails.area}</strong></article>
          <article><span>Priority</span><strong className={`s3-priority ${(taskDetails.priority || "normal").toLowerCase()}`}>{taskDetails.priority}</strong></article>
          <article><span>Due Date</span><strong>{taskDetails.due}</strong></article>
          <article><span>Current Milestone</span><strong>{readableMilestone(taskDetails.milestone)}</strong></article>
        </div>
        <div className="s3-execution-body">
          <SurveyTimeline task={task} />
          <TaskDetailsCard taskDetails={taskDetails} allowedAction={allowedAction} mark={mark} uploadReport={uploadReport} saveFieldNotes={saveFieldNotes} current={current} realTask={realTask} />
        </div>
      </section>
      <section className="s3-card s3-report-panel">
        <PanelTitle n="3" title="Field Notes & Report" />
        <div className="s3-note-tabs"><button type="button" className="active">Field Notes</button><button type="button">Report Metadata</button></div>
        <label className="s3-label">Add Field Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        <small className="s3-char-count">Characters: {notes.length}/1000</small>
        <h3>Attachments</h3>
        <div className="s3-attachments"><span /><span /><span /><button type="button">+</button></div>
        <h3>Report Metadata</h3>
        <label className="s3-label">Report File Name<input value={fileName} onChange={(e) => setFileName(e.target.value)} /></label>
        <dl className="s3-report-meta"><dt>Surveyor</dt><dd>{session().fullName || "Eng. Bilal Ahmad"}</dd><dt>Report Type</dt><dd>Field Survey</dd><dt>Status</dt><dd>{task?.report_uploaded ? "Uploaded" : "Pending"}</dd></dl>
        <h3>Location (GPS)</h3>
        <div className="s3-gps"><article><span>Latitude</span><strong>31.9532</strong></article><article><span>Longitude</span><strong>35.9106</strong></article></div>
        <button type="button" disabled={!task} onClick={saveFieldNotes}>Save Notes</button>
      </section>
    </div>
  );
}

function TaskProgress({ task, large = false }) {
  const current = normalizeMilestone(task?.current_milestone || task?.status || "assigned");
  const currentIndex = milestones.indexOf(current);
  return <div className={`s3-milestones ${large ? "large" : ""}`}>{milestones.map((step, index) => <div className={index <= currentIndex ? "done" : ""} key={step}><i>{index + 1}</i><span>{step}</span><small>{index <= currentIndex ? "Completed" : "Pending"}</small></div>)}</div>;
}

function SurveyTimeline({ task }) {
  const current = normalizeMilestone(task?.current_milestone || task?.status || "assigned");
  const currentIndex = milestones.indexOf(current);
  return (
    <div className="s3-survey-timeline">
      {milestones.slice(1).map((step, index) => {
        const realIndex = index + 1;
        return <div className={realIndex <= currentIndex ? "done" : realIndex === currentIndex + 1 ? "next" : ""} key={step}><i /> <strong>{readableMilestone(step)}</strong><span>{realIndex <= currentIndex ? "Completed" : realIndex === currentIndex + 1 ? "Next step" : "Pending"}</span><small>{realIndex <= currentIndex ? "by Surveyor" : ""}</small></div>;
      })}
    </div>
  );
}

function TaskDetailsCard({ taskDetails, allowedAction, mark, uploadReport, saveFieldNotes, current, realTask }) {
  const workflowActions = [
    ["visit_scheduled", "Mark Visit Scheduled"],
    ["arrived_on_site", "Mark Arrived on Site"],
    ["survey_started", "Mark Survey Started"],
    ["survey_completed", "Mark Survey Completed"],
  ];
  return (
    <div className="s3-task-details-card">
      <h3>Task Details</h3>
      <dl><dt>Parcel No.</dt><dd>{taskDetails.parcel}</dd><dt>Zone</dt><dd>{taskDetails.zone}</dd><dt>Area</dt><dd>{taskDetails.area}</dd><dt>Active Milestone</dt><dd>{readableMilestone(taskDetails.milestone)}</dd><dt>Application Type</dt><dd>Ownership Transfer</dd><dt>Priority</dt><dd>{taskDetails.priority}</dd><dt>Due Date</dt><dd>{taskDetails.due}</dd></dl>
      <div className="s3-execution-actions">
        {workflowActions.map(([step, label]) => <button type="button" key={step} disabled={allowedAction !== step} onClick={() => mark(step)}>{label}</button>)}
        <button type="button" disabled={allowedAction !== "upload_report"} onClick={uploadReport}>Upload Report</button>
        <button type="button" className="secondary" disabled={!taskDetails.applicationId} onClick={saveFieldNotes}>Add Field Notes</button>
      </div>
    </div>
  );
}

function QuickFieldActions({ task }) {
  return <div className="s3-quick"><Link to={`/student3/execution/${task?.application_number || task?.application_id || ""}`}>Open Task Details</Link><Link to="/student3/map">View Parcel Location</Link><Link to="/student3/analytics">Open Analytics</Link></div>;
}

function ReportBox({ task }) {
  return <div className="s3-report-box"><textarea defaultValue="Upload survey report metadata, add field notes, and attach survey images here." /><div className="s3-thumbs"><span /><span /><span /><button type="button">+</button></div><p>Latitude 31.9021 / Longitude 35.2001</p><Link to={`/student3/execution/${task?.application_number || task?.application_id || ""}`}>Edit Notes</Link></div>;
}

export function Student3MapPage() {
  return <section className="s3-card s3-page-card"><PanelTitle n="4" title="Live Parcel Map" /><Student3Map /></section>;
}

function Student3Map({ compact = false }) {
  const holderRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const clusterRef = useRef(null);
  const [feed, setFeed] = useState(null);
  const [filters, setFilters] = useState({ zone: "", type: "", status: "", disputed: false });

  async function load() {
    const [parcels, heatmap] = await Promise.all([getParcels(), getPendingHeatmap().catch(() => ({ features: [] }))]);
    setFeed({ ...parcels, heatmap: heatmap.features || [] });
  }
  useEffect(() => { load().catch(() => setFeed({ type: "FeatureCollection", features: [] })); }, []);
  useEffect(() => {
    if (!holderRef.current || mapRef.current) return;
    const map = L.map(holderRef.current, { zoomControl: true }).setView([31.9, 35.2], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "OpenStreetMap" }).addTo(map);
    mapRef.current = map;
  }, []);
  useEffect(() => {
    if (!mapRef.current || !feed) return;
    if (layerRef.current) layerRef.current.remove();
    if (clusterRef.current) clusterRef.current.remove();
    const features = (feed.features || []).filter((feature) => {
      const p = feature.properties || {};
      if (filters.zone && p.zone_id !== filters.zone) return false;
      if (filters.type && p.type !== filters.type) return false;
      if (filters.status && p.status !== filters.status) return false;
      if (filters.disputed && p.dispute_state !== "disputed" && p.status !== "under_objection") return false;
      return true;
    });
    layerRef.current = L.geoJSON({ type: "FeatureCollection", features }, {
      style: (feature) => {
        const status = feature.properties?.status;
        return { color: status === "survey_required" ? "#f59e0b" : status === "under_objection" ? "#ef4444" : status === "approved" ? "#10b981" : "#2563eb", fillOpacity: 0.24, weight: 2 };
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties || {};
        layer.bindPopup(`<b>${p.parcel_number || "Parcel"}</b><br>${p.zone_id || ""}<br>${p.status || ""}`);
      },
    }).addTo(mapRef.current);
    clusterRef.current = L.layerGroup(
      features.slice(0, 18).map((feature, index) => {
        const ring = feature.geometry?.coordinates?.[0] || [];
        const first = ring[0] || [35.2 + index * 0.002, 31.9 + index * 0.002];
        return L.circleMarker([first[1], first[0]], { radius: index % 4 === 0 ? 18 : 8, color: "#2563eb", fillColor: index % 3 === 0 ? "#f59e0b" : "#10b981", fillOpacity: 0.72 }).bindTooltip(index % 4 === 0 ? `${index + 3}` : "1");
      }),
    ).addTo(mapRef.current);
    if (layerRef.current.getBounds().isValid()) mapRef.current.fitBounds(layerRef.current.getBounds(), { padding: [20, 20] });
  }, [feed, filters]);

  return (
    <div className={compact ? "s3-map-wrap compact" : "s3-map-wrap"}>
      {!compact && <div className="s3-map-filters"><select value={filters.zone} onChange={(e) => setFilters({ ...filters, zone: e.target.value })}><option value="">All Zones</option><option>ZONE-RM-01</option><option>ZONE-RM-02</option><option>ZONE-RM-03</option></select><select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}><option value="">All Types</option><option>ownership_transfer</option><option>first_registration</option><option>boundary_correction</option></select><select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All Statuses</option><option>submitted</option><option>survey_required</option><option>under_objection</option><option>approved</option></select><button type="button" onClick={() => setFilters({ ...filters, disputed: !filters.disputed })}>Disputed Parcels</button><button type="button" onClick={load}>Refresh Map</button></div>}
      <div ref={holderRef} className="s3-leaflet" />
      <div className="s3-map-badges"><span>Pending Applications</span><span>Survey Required</span><span>Disputed Parcels</span><span>Completed Surveys</span></div>
    </div>
  );
}

function MapLegend() {
  return <div className="s3-legend">{["Parcel Boundaries", "Pending Applications", "Survey Required", "Disputed Parcels", "Completed Surveys", "Zones", "Surveyors"].map((item, index) => <label key={item}><input type="checkbox" defaultChecked /> <i className={`dot d${index}`} />{item}</label>)}<div className="s3-scale"><span>Marker Clustering</span><input type="range" defaultValue="60" /></div></div>;
}

export function Student3AnalyticsPage() {
  return <section className="s3-card s3-page-card"><PanelTitle n="5" title="Analytics Dashboard" /><Student3Analytics /></section>;
}

function Student3Analytics({ compact = false }) {
  const [data, setData] = useState({ kpis: {}, status: [], zone: [], processing: [], surveyors: [], apps: [] });
  async function load() {
    const [kpis, status, zone, processing, surveyors, apps] = await Promise.all([getKpis(), getByStatus(), getByZone(), getProcessingTime(), getSurveyors(), getApplications({ limit: 80 })]);
    setData({ kpis, status, zone, processing, surveyors, apps: itemsOf(apps) });
  }
  useEffect(() => { load().catch(() => null); }, []);
  const objections = data.apps.filter((app) => app.status === "under_objection").length || data.kpis.under_objection || 23;
  return (
    <div className={compact ? "s3-analytics compact" : "s3-analytics"}>
      {!compact && <div className="s3-toolbar"><button type="button" onClick={load}>Refresh Analytics</button><button type="button" onClick={() => exportCsv(data)}>CSV Export</button><button type="button" onClick={() => window.print()}>PDF Export</button></div>}
      <div className="s3-chart-grid">
        <ChartCard title="Applications Over Time" type="line" values={[12, 18, 15, 22, 31, 28, 39]} />
        <DonutCard title="Pending Applications by Zone" items={data.zone.length ? data.zone : [{ _id: "RM-01", count: 42 }, { _id: "RM-02", count: 31 }, { _id: "RM-03", count: 19 }]} />
        <ChartCard title="Average Processing Time (Days)" big="7.6" type="line" values={data.processing.map((item) => Math.round(item.avg_processing_hours || 0)).slice(0, 7)} />
        <BarCard title="Surveyor Workload" items={data.surveyors.length ? data.surveyors.map((s) => ({ label: s.name || s.staff_code, value: s.task_count || s.workload?.active_tasks || 1 })) : [{ label: "Hasan", value: 16 }, { label: "Omar", value: 12 }, { label: "Leila", value: 9 }]} />
        <DonutCard title="Applications Under Objection" center={objections} items={[{ _id: "Resolved", count: 18 }, { _id: "Under Review", count: objections }, { _id: "Rejected", count: 5 }]} />
        <ChartCard title="Certificates Issued Per Month" type="bars" values={[4, 8, 11, 13, 18, 22, 26]} />
      </div>
    </div>
  );
}

function ChartCard({ title, values = [], big, type }) {
  const safe = values.length ? values : [3, 5, 4, 9, 7, 10, 12];
  const max = Math.max(...safe, 1);
  return <article className="s3-chart"><h3>{title}</h3>{big && <strong>{big}</strong>}<div className={type === "bars" ? "s3-bars" : "s3-line"}>{safe.map((value, index) => <span key={index} style={{ "--h": `${Math.max(12, (value / max) * 100)}%` }} />)}</div></article>;
}

function DonutCard({ title, items, center }) {
  const total = items.reduce((sum, item) => sum + (item.count || 0), 0) || 1;
  return <article className="s3-chart"><h3>{title}</h3><div className="s3-donut"><b>{center || total}</b></div><ul>{items.slice(0, 4).map((item) => <li key={item._id}><span>{item._id || "none"}</span><b>{item.count}</b></li>)}</ul></article>;
}

function BarCard({ title, items }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return <article className="s3-chart"><h3>{title}</h3><div className="s3-workload">{items.slice(0, 6).map((item) => <label key={item.label}><span>{item.label}</span><i style={{ "--w": `${(item.value / max) * 100}%` }} /><b>{item.value}</b></label>)}</div></article>;
}

export function Student3ReportsPage() {
  const [logs, setLogs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState("");

  async function loadLogs() {
    try {
      const [logData, notificationData] = await Promise.all([getLogs(), getNotifications()]);
      const userLinkedId = localStorage.getItem("linked_id");
      setLogs(itemsOf(logData));
      setNotifications(itemsOf(notificationData).filter((item) => !item.recipient_id || item.recipient_id === userLinkedId || item.recipient_type !== "applicant"));
      setError("");
    } catch (err) {
      setError(backendMessage(err));
    }
  }

  useEffect(() => {
    loadLogs();
  }, []);

  const events = logs.flatMap((log) =>
    (log.event_stream || []).map((event) => ({
      ...event,
      application_id: log.application_id,
    })),
  ).sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
  const surveyEvents = events.filter((event) => event.type?.startsWith("survey_") || ["visit_scheduled", "arrived_on_site", "survey_started", "survey_completed", "report_uploaded"].includes(event.type));

  return (
    <div className="s3-grid reports">
      <section className="s3-card"><PanelTitle n="6" title="Survey Schedule This Week" /><table className="s3-table small"><tbody>{["Sat", "Sun", "Mon", "Tue", "Wed"].map((day) => <tr key={day}><td>{day}</td><td><Badge value="available" /></td><td><Badge value="field_visit" /></td></tr>)}</tbody></table></section>
      <section className="s3-card"><PanelTitle n="7" title="Quick Actions" /><div className="s3-action-grid"><Link to="/student3/tasks">Assigned Tasks</Link><Link to="/student3/map">Open Map</Link><Link to="/student3/analytics">Analytics</Link><button type="button" onClick={() => window.print()}>Print Report</button><button type="button" onClick={loadLogs}>Refresh Activity</button></div></section>
      <section className="s3-card"><PanelTitle n="8" title="Recent Activity" />{error && <div className="s3-error">{error}</div>}<ActivityList events={surveyEvents} /></section>
      <section className="s3-card"><PanelTitle n="9" title="Notifications" /><NotificationList notifications={notifications} /></section>
    </div>
  );
}

function ActivityList({ events = [], notices = false }) {
  const fallback = [
    { type: "survey_report_uploaded", at: null, metadata: { note: "Survey report submitted" } },
    { type: "arrived_on_site", at: null, metadata: { note: "Arrived on site" } },
    { type: "survey_field_note_added", at: null, metadata: { note: "Field notes added" } },
  ];
  const rows = (events.length ? events : fallback).slice(0, 8);
  return <div className="s3-activity">{rows.map((event, index) => <p key={`${event.type}-${event.at || index}`}><i>{index + 1}</i>{formatSurveyEvent(event, notices)}<span>{formatActivityTime(event.at)}</span></p>)}</div>;
}

function NotificationList({ notifications = [] }) {
  const rows = notifications.length ? notifications.slice(0, 8) : [];
  if (!rows.length) return <div className="s3-activity"><p><i>1</i>No notifications yet<span>now</span></p></div>;
  return <div className="s3-activity">{rows.map((item, index) => <p key={item._id || index}><i>{index + 1}</i>{item.message || item.subject || item.type}<span>{formatActivityTime(item.created_at)}</span></p>)}</div>;
}

function formatSurveyEvent(event, notices = false) {
  const note = event.metadata?.note;
  if (event.type === "survey_field_note_added") return `${notices ? "Notification: " : ""}Field note added${note ? `: ${note}` : ""}`;
  if (event.type === "survey_report_uploaded") return `${notices ? "Notification: " : ""}Survey report metadata uploaded`;
  if (event.type === "survey_completed") return `${notices ? "Notification: " : ""}Survey completed`;
  return `${event.type || "survey_event"}`.replaceAll("_", " ");
}

function formatActivityTime(value) {
  if (!value) return "sample";
  const date = new Date(value);
  if (date.toString() === "Invalid Date") return value;
  return date.toLocaleString();
}

function Badge({ value }) {
  return <span className={`s3-badge ${statusTone(value)}`}>{value}</span>;
}

function exportCsv(data) {
  const rows = [["metric", "value"], ["total_applications", data.kpis?.total_applications || 0], ["certificates_issued", data.kpis?.certificates_issued || 0]];
  const blob = new Blob([rows.map((row) => row.join(",")).join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "student3-analytics.csv";
  link.click();
  URL.revokeObjectURL(url);
}
