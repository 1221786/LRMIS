import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import L from "leaflet";
import {
  API_BASE_URL,
  api,
  getApplications,
  getAnalyticsDashboard,
  getByStatus,
  getByZone,
  getKpis,
  getLogs,
  getNotifications,
  getParcels,
  getPendingHeatmap,
  getProcessingTime,
  getSurveyors,
  getStaffMembers,
  createStaffMember,
  updateStaffMember,
  deleteStaffMember,
  autoAssignSurveyor,
  reassignSurveyTask,
  getSurveyReports,
  reviewSurveyReport,
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
          <NavGroup title="" items={[["Dashboard", "/student3/tasks"], ["My Survey Tasks", "/student3/tasks"], ["Survey Task Execution", "/student3/execution"], ["Survey Reports", "/student3/reports"], ["Surveyors", "/student3/surveyors"], ["Registrars", "/student3/registrars"], ["Coverage Zones", "/student3/map"], ["Skills & Specialization", "/student3/reports"], ["Schedules & Availability", "/student3/reports"], ["Assignments", "/student3/assignments"], ["Live Parcel Map", "/student3/map"], ["Analytics Dashboard", "/student3/analytics"], ["Registrar Review", "/student3/registrar-review"]]} />
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
  const [kpis, setKpis] = useState(null);
  const [message, setMessage] = useState("");
  async function load() {
    const [data, kpiData] = await Promise.all([getSurveyTasks(), getKpis().catch(() => null)]);
    setTasks(itemsOf(data));
    setKpis(kpiData);
    setMessage("Survey tasks refreshed from MongoDB.");
  }
  useEffect(() => { load().catch(() => setTasks([])); }, []);
  const completed = tasks.filter((task) => ["survey_completed", "report_uploaded", "registrar_reviewed"].includes(normalizeMilestone(task.current_milestone || task.status))).length;
  const pending = tasks.filter((task) => !["survey_completed", "report_uploaded", "registrar_reviewed"].includes(normalizeMilestone(task.current_milestone || task.status))).length;
  return <div className="s3-stack"><div className="s3-surveyor-summary"><article className="blue"><span>A</span><div><small>Total Applications</small><strong>{kpis?.total_applications ?? tasks.length}</strong></div></article><article className="orange"><span>P</span><div><small>Pending Applications</small><strong>{kpis?.pending ?? pending}</strong></div></article><article className="green"><span>S</span><div><small>Survey Completed</small><strong>{completed}</strong></div></article><article className="purple"><span>C</span><div><small>Certificates Issued</small><strong>{kpis?.certificates_issued ?? 0}</strong></div></article></div>{message && <div className="s3-success">{message}</div>}<SurveyTasksPanel tasks={tasks} onRefresh={load} full simple /></div>;
}

function SurveyTasksPanel({ tasks, onRefresh, full = true, simple = false }) {
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
        <div><PanelTitle title="My Survey Tasks" /><p>View your assigned survey tasks and their current status.</p></div>
        <div className="s3-toolbar">{simple && <select value={filters.milestone} onChange={(event) => setFilters({ ...filters, milestone: event.target.value })}><option value="">All Milestones</option>{milestones.map((step) => <option key={step} value={step}>{readableMilestone(step)}</option>)}</select>}<button type="button" onClick={onRefresh}>Refresh</button></div>
      </div>
      {!simple && <><div className="s3-tabs">{["All", "Assigned", "In Progress", "Completed", "Pending Report"].map((item) => <button type="button" className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item}</button>)}</div><div className="s3-filter-row"><input placeholder="Zone" value={filters.zone} onChange={(event) => setFilters({ ...filters, zone: event.target.value })} /><select value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value })}><option value="">All Priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="normal">Normal</option><option value="low">Low</option></select><select value={filters.milestone} onChange={(event) => setFilters({ ...filters, milestone: event.target.value })}><option value="">All Milestones</option>{milestones.map((step) => <option key={step}>{step}</option>)}</select></div></>}
      <SurveyTaskTable tasks={filtered.length || filters.milestone ? filtered : tasks} full={full} simple={simple} />
    </section>
  );
}

function SurveyTaskTable({ tasks, full = false, simple = false }) {
  const rows = tasks.length ? tasks : fallbackSurveyTasks;
  return (
    <table className="s3-table">
      <thead><tr>{!simple && <th>Task ID</th>}<th>Application ID</th><th>Parcel Number</th><th>Zone</th><th>Priority</th><th>Scheduled Visit</th><th>Current Milestone</th>{!simple && <th>Status</th>}{full && <th>Actions</th>}</tr></thead>
      <tbody>{rows.map((task) => <tr key={task.task_id || task._id}>{!simple && <td>{task.task_id}</td>}<td>{task.application_number || task.application_id}</td><td>{task.parcel_number || task.parcel_ref?.parcel_number || "-"}</td><td>{task.zone_id || task.zone || task.parcel_ref?.zone_id || "-"}</td><td><span className={`s3-priority ${(task.priority || "normal").toLowerCase()}`}>{task.priority || "normal"}</span></td><td>{scheduledVisit(task)}</td><td><span className={`s3-milestone-label ${statusTone(task.current_milestone || task.status)}`}>{readableMilestone(task.current_milestone || task.status)}</span></td>{!simple && <td><Badge value={taskStatusGroup(task)} /></td>}{full && <td><div className="s3-row-actions"><Link title="View task" to={`/student3/execution/${task.application_number || task.application_id}`}>View</Link>{!simple && <><Link title="Open execution" to={`/student3/execution/${task.application_number || task.application_id}`}>Open</Link><Link title="View parcel on map" to="/student3/map">Map</Link></>}</div></td>}</tr>)}</tbody>
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
  const [reportType, setReportType] = useState("boundary_survey");
  const [surveyMethod, setSurveyMethod] = useState("GNSS");
  const [reportFile, setReportFile] = useState(null);
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
      file_name: reportFile?.name || fileName,
      file_url: `/uploads/${reportFile?.name || fileName}`,
      summary: notes,
      findings: { boundary_matches: true, measured_by: surveyMethod, dispute_found: false, report_type: reportType },
      attachments: [{ file_name: reportFile?.name || fileName, type: reportType }],
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
    <div className="s3-survey-execution-screen">
      <section className="s3-card s3-survey-execution-card">
        <header className="s3-survey-execution-head"><div><h1>Survey Task Execution</h1><p>Update milestones, upload report and add field notes for the selected task.</p></div><Link to={`/student2/staff/applications/${taskDetails.applicationId}`}>View Application</Link></header>
        {message && <div className="s3-success">{message}</div>}
        {error && <div className="s3-error">{error}</div>}
        <label className="s3-label">Select Task<select value={selectedId} onChange={(e) => { setSelectedId(e.target.value); setMessage(""); setError(""); navigate(`/student3/execution/${e.target.value}`); }}>{taskPool.map((item) => <option key={item._id || item.task_id} value={item.application_number || item.application_id}>{item.task_id} - {item.application_number || item.application_id}</option>)}</select></label>
        <section className="s3-execution-progress"><h2>Milestone Progress</h2><TaskProgress task={task} large /></section>
        <section className="s3-update-milestone"><h2>Update Milestone</h2><div>{[["visit_scheduled", "Mark Visit Scheduled"], ["arrived_on_site", "Mark On Site"], ["survey_started", "Mark Survey Started"], ["survey_completed", "Mark Survey Completed"]].map(([step, label]) => <button type="button" key={step} disabled={allowedAction !== step} onClick={() => mark(step)}>{label}</button>)}<button type="button" disabled={allowedAction !== "upload_report"} onClick={() => document.getElementById("s3-report-file")?.click()}>Upload Report</button></div></section>
        <section className="s3-execution-workspace">
          <article>
            <h2>Upload Survey Report Metadata</h2>
            <div className="s3-report-form">
              <label>Report Type<select value={reportType} onChange={(event) => setReportType(event.target.value)}><option value="boundary_survey">Boundary Survey</option><option value="gps_survey">GPS Survey</option><option value="subdivision_survey">Subdivision Survey</option></select></label>
              <label>Survey Method<select value={surveyMethod} onChange={(event) => setSurveyMethod(event.target.value)}><option>GNSS</option><option>Total Station</option><option>Drone</option></select></label>
              <label className="span-2">File Upload<input id="s3-report-file" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => { const selected = event.target.files?.[0] || null; setReportFile(selected); if (selected) setFileName(selected.name); }} /></label>
              <label className="span-2">Description<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
            </div>
            <button type="button" disabled={allowedAction !== "upload_report" || !reportFile} onClick={uploadReport}>Upload Report</button>
          </article>
          <article>
            <h2>Field Notes</h2>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Valid boundary markers found. No encroachment detected." />
            <button type="button" disabled={!task} onClick={saveFieldNotes}>Save Notes</button>
          </article>
        </section>
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
  return <section className="s3-card s3-page-card s3-live-map-page"><div className="s3-live-map-title"><h1>Live Parcel Map</h1><p>View parcels and applications on the map.</p></div><Student3Map /></section>;
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
    const colorFor = (properties = {}) => {
      if (properties.assigned_surveyor === localStorage.getItem("linked_id") || properties.my_task) return "#10b981";
      if (properties.dispute_state === "disputed" || properties.status === "under_objection") return "#ef4444";
      if (properties.status === "survey_required") return "#2563eb";
      if (["submitted", "pre_checked", "missing_documents"].includes(properties.status)) return "#f59e0b";
      return "#2563eb";
    };
    layerRef.current = L.geoJSON({ type: "FeatureCollection", features }, {
      style: (feature) => {
        const color = colorFor(feature.properties);
        return { color, fillColor: color, fillOpacity: 0.22, weight: 2 };
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties || {};
        const applicationId = p.application_id || p.application_number || "";
        layer.bindPopup(`<div class="s3-map-popup"><b>Parcel ${p.parcel_number || "-"}</b><span><strong>Zone:</strong> ${p.zone_id || "-"}</span><span><strong>Owner:</strong> ${p.owner_name || p.applicant_name || "-"}</span><span><strong>Area:</strong> ${p.area_sqm || "-"} m²</span><span><strong>Status:</strong> ${p.status || "-"}</span><span><strong>Application:</strong> ${applicationId || "-"}</span>${applicationId ? `<a href="/student3/execution/${applicationId}">View Details</a>` : ""}</div>`);
      },
    }).addTo(mapRef.current);
    const markers = features.slice(0, 30).map((feature, index) => {
        const ring = feature.geometry?.coordinates?.[0] || [];
        const first = ring[0] || [35.2 + index * 0.002, 31.9 + index * 0.002];
        const marker = L.circleMarker([first[1], first[0]], { radius: index % 6 === 0 ? 17 : 7, color: "#fff", weight: 2, fillColor: index % 6 === 0 ? "#1769d3" : colorFor(feature.properties), fillOpacity: 0.9 });
        marker.bindTooltip(index % 6 === 0 ? `${Math.min(12, features.length - index)}` : "", { permanent: index % 6 === 0, direction: "center", className: "s3-cluster-label" });
        marker.on("click", () => {
          if (index % 6 === 0) mapRef.current.setView(marker.getLatLng(), Math.min(mapRef.current.getZoom() + 3, 18));
        });
        return marker;
      });
    clusterRef.current = L.layerGroup(markers).addTo(mapRef.current);
    if (layerRef.current.getBounds().isValid()) mapRef.current.fitBounds(layerRef.current.getBounds(), { padding: [20, 20] });
  }, [feed, filters]);

  return (
    <div className={compact ? "s3-map-wrap compact" : "s3-map-wrap"}>
      {!compact && <div className="s3-map-filters"><label>Zone<select value={filters.zone} onChange={(e) => setFilters({ ...filters, zone: e.target.value })}><option value="">All Zones</option><option>ZONE-RM-01</option><option>ZONE-RM-02</option><option>ZONE-RM-03</option><option>Zone A</option><option>Zone B</option></select></label><label>Type<select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}><option value="">All Types</option><option value="ownership_transfer">Ownership Transfer</option><option value="first_registration">First Registration</option><option value="parcel_subdivision">Subdivision</option><option value="parcel_merge">Merge</option><option value="boundary_correction">Boundary Correction</option><option value="certificate_request">Certificate Request</option></select></label><label>Status<select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All Status</option><option value="submitted">Pending</option><option value="survey_required">Survey Required</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="under_objection">Under Objection</option><option value="closed">Closed</option></select></label></div>}
      <div className="s3-map-content"><div className="s3-map-legend"><p><i className="boundary" />Parcel Boundary</p><p><i className="pending" />Pending Application</p><p><i className="survey" />Survey Required</p><p><i className="disputed" />Disputed Parcel</p><p><i className="mine" />My Tasks</p><p><i className="cluster" />Cluster</p></div><div ref={holderRef} className="s3-leaflet" /></div>
    </div>
  );
}

function MapLegend() {
  return <div className="s3-legend">{["Parcel Boundaries", "Pending Applications", "Survey Required", "Disputed Parcels", "Completed Surveys", "Zones", "Surveyors"].map((item, index) => <label key={item}><input type="checkbox" defaultChecked /> <i className={`dot d${index}`} />{item}</label>)}<div className="s3-scale"><span>Marker Clustering</span><input type="range" defaultValue="60" /></div></div>;
}

export function Student3AnalyticsPage() {
  return <Student3Analytics />;
}

function Student3Analytics({ compact = false }) {
  const [data, setData] = useState({ applications_over_time: [], pending_by_zone: [], average_processing_days: 0, surveyor_workload: [], objections_by_type: [], certificates_by_month: [] });
  const [dates, setDates] = useState({ from: "2024-04-01", to: "2024-04-30" });
  const [appliedDates, setAppliedDates] = useState({ from: "2024-04-01", to: "2024-04-30" });
  const [exportOpen, setExportOpen] = useState(false);
  async function load(range = appliedDates) {
    setData(await getAnalyticsDashboard({ date_from: range.from, date_to: range.to }));
  }
  useEffect(() => { load().catch(() => null); }, []);
  const timeline = analyticsTimeline(data.applications_over_time);
  const objections = data.objections_by_type.reduce((sum, item) => sum + item.count, 0);
  function exportCsvFile() { exportAnalyticsCsv(data); }
  function exportPdf() { setExportOpen(false); window.print(); }
  return (
    <div className={compact ? "s3-analytics compact" : "s3-analytics s3-analytics-page"}>
      {!compact && <header className="s3-analytics-head"><div><h1>Analytics Dashboard</h1><p>Overview of applications and survey performance.</p></div><div className="s3-analytics-controls"><label><input type="date" value={dates.from} onChange={(event) => setDates({ ...dates, from: event.target.value })} /><span>-</span><input type="date" value={dates.to} onChange={(event) => setDates({ ...dates, to: event.target.value })} /></label><button onClick={() => { setAppliedDates(dates); load(dates); }}>Apply</button><div className="s3-export-menu"><button onClick={() => setExportOpen((value) => !value)}>Export</button>{exportOpen && <div><button onClick={exportPdf}>Export PDF</button><button onClick={exportCsvFile}>Export CSV</button><button onClick={() => window.print()}>Print Report</button></div>}</div></div></header>}
      <div className="s3-chart-grid">
        <ApplicationsTimelineChart timeline={timeline} />
        <DonutCard title="Pending Applications by Zone" items={data.pending_by_zone} />
        <ChartCard title="Average Processing Time" big={`${data.average_processing_days} Days`} type="line" values={[data.average_processing_days]} />
        <BarCard title="Surveyor Workload" items={data.surveyor_workload.map((item) => ({ label: item.label, value: item.count }))} />
        <DonutCard title="Applications Under Objection" center={objections} items={data.objections_by_type} />
        <ChartCard title="Certificates Issued / Month" type="bars" values={data.certificates_by_month.map((item) => item.count)} />
      </div>
    </div>
  );
}

function ChartCard({ title, values = [], big, type }) {
  const safe = values.length ? values : [3, 5, 4, 9, 7, 10, 12];
  const max = Math.max(...safe, 1);
  return <article className="s3-chart"><h3>{title}</h3>{big && <strong>{big}</strong>}<div className={type === "bars" ? "s3-bars" : "s3-line"}>{safe.map((value, index) => <span key={index} style={{ "--h": `${Math.max(12, (value / max) * 100)}%` }} />)}</div></article>;
}

function analyticsTimeline(rows = []) {
  const months = [...new Set(rows.map((item) => item._id?.month).filter(Boolean))].sort();
  const value = (month, status) => rows.find((item) => item._id?.month === month && item._id?.status === status)?.count || 0;
  return { months, submitted: months.map((month) => value(month, "submitted")), approved: months.map((month) => value(month, "approved")), rejected: months.map((month) => value(month, "rejected")) };
}

function ApplicationsTimelineChart({ timeline }) {
  const all = [...timeline.submitted, ...timeline.approved, ...timeline.rejected];
  const max = Math.max(...all, 1);
  const x = (index) => timeline.months.length <= 1 ? 60 : 16 + (index / (timeline.months.length - 1)) * 98;
  const y = (value) => 84 - (value / max) * 66;
  const points = (values) => values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
  const ticks = [0, .25, .5, .75, 1];
  return <article className="s3-chart s3-multi-line"><h3>Applications Over Time</h3><div className="s3-line-legend"><span className="submitted">Submitted</span><span className="approved">Approved</span><span className="rejected">Rejected</span></div><svg viewBox="0 0 120 100" preserveAspectRatio="none">{ticks.map((tick) => <g key={tick}><line className="grid" x1="15" x2="116" y1={84 - tick * 66} y2={84 - tick * 66} /><text x="1" y={86 - tick * 66}>{Math.round(max * tick)}</text></g>)}<line className="axis" x1="15" x2="15" y1="16" y2="84" /><line className="axis" x1="15" x2="116" y1="84" y2="84" /><polyline className="submitted" points={points(timeline.submitted)} /><polyline className="approved" points={points(timeline.approved)} /><polyline className="rejected" points={points(timeline.rejected)} />{timeline.submitted.map((value, index) => <circle className="submitted" key={`s-${index}`} cx={x(index)} cy={y(value)} r="1.5" />)}{timeline.approved.map((value, index) => <circle className="approved" key={`a-${index}`} cx={x(index)} cy={y(value)} r="1.5" />)}{timeline.rejected.map((value, index) => <circle className="rejected" key={`r-${index}`} cx={x(index)} cy={y(value)} r="1.5" />)}</svg><div className="s3-month-labels">{timeline.months.map((month) => <span key={month}>{month}</span>)}</div>{!timeline.months.length && <p className="s3-no-data">No applications in selected range.</p>}</article>;
}

function exportAnalyticsCsv(data) {
  const rows = [["section", "label", "value"]];
  data.pending_by_zone.forEach((item) => rows.push(["pending_by_zone", item._id, item.count]));
  data.surveyor_workload.forEach((item) => rows.push(["surveyor_workload", item.label, item.count]));
  data.objections_by_type.forEach((item) => rows.push(["objections", item._id, item.count]));
  data.certificates_by_month.forEach((item) => rows.push(["certificates", item._id, item.count]));
  rows.push(["processing", "average_days", data.average_processing_days]);
  const blob = new Blob([rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "lrmis-analytics.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function DonutCard({ title, items, center }) {
  const total = items.reduce((sum, item) => sum + (item.count || 0), 0) || 1;
  return <article className="s3-chart"><h3>{title}</h3><div className="s3-donut"><b>{center || total}</b></div><ul>{items.slice(0, 4).map((item) => <li key={item._id}><span>{item._id || "none"}</span><b>{item.count}</b></li>)}</ul></article>;
}

function BarCard({ title, items }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  const ticks = [0, Math.ceil(max * .25), Math.ceil(max * .5), Math.ceil(max * .75), max];
  return <article className="s3-chart s3-workload-chart"><h3>{title}</h3><div className="s3-workload">{items.slice(0, 6).map((item) => <label key={item.label}><span>{item.label}</span><i><em style={{ width: `${(item.value / max) * 100}%` }} /></i><b>{item.value}</b></label>)}</div><div className="s3-workload-axis"><span /><div>{ticks.map((tick, index) => <b key={`${tick}-${index}`}>{tick}</b>)}</div><span /></div><small>Assigned Tasks</small>{!items.length && <p className="s3-no-workload">No assigned survey tasks in selected range.</p>}</article>;
}

const emptySurveyor = {
  staff_code: "",
  name: "",
  zones: "",
  skills: "",
  phone: "",
  email: "",
  status: "active",
  max_tasks: 10,
};

export function Student3SurveyorsPage() {
  const [surveyors, setSurveyors] = useState([]);
  const [form, setForm] = useState(emptySurveyor);
  const [mode, setMode] = useState("");
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const data = await getStaffMembers("surveyor");
      setSurveyors(itemsOf(data));
      setError("");
    } catch (err) {
      setError(backendMessage(err));
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setForm(emptySurveyor);
    setSelected(null);
    setMode("create");
  }

  function openEdit(item) {
    setSelected(item);
    setForm({
      staff_code: item.staff_code || "",
      name: item.name || item.full_name || "",
      zones: (item.zones || item.zone_ids || []).join(", "),
      skills: (item.skills || []).join(", "),
      phone: item.contacts?.phone || "",
      email: item.contacts?.email || "",
      status: item.active === false ? "inactive" : item.availability?.status || (item.availability?.active === false ? "on_leave" : "active"),
      max_tasks: item.workload?.max_tasks || 10,
    });
    setMode("edit");
  }

  async function save(event) {
    event.preventDefault();
    const zones = form.zones.split(",").map((value) => value.trim()).filter(Boolean);
    const skills = form.skills.split(",").map((value) => value.trim()).filter(Boolean);
    if (!form.name.trim() || !form.staff_code.trim() || !zones.length) {
      setError("Name, surveyor code, and at least one coverage zone are required.");
      return;
    }
    const payload = {
      name: form.name.trim(),
      zones,
      zone_ids: zones,
      skills,
      workload: { active_tasks: selected?.workload?.active_tasks || 0, max_tasks: Number(form.max_tasks) || 10 },
      contacts: { phone: form.phone.trim(), email: form.email.trim() },
      availability: { active: form.status === "active", status: form.status },
      active: form.status !== "inactive",
    };
    try {
      if (mode === "create") {
        await createStaffMember({ ...payload, staff_code: form.staff_code.trim(), role: "surveyor" });
        setMessage("Surveyor added successfully.");
      } else {
        await updateStaffMember(selected._id || selected.staff_code, payload);
        setMessage("Surveyor updated successfully.");
      }
      setMode("");
      setError("");
      await load();
    } catch (err) {
      setError(backendMessage(err));
    }
  }

  async function remove(item) {
    if (!window.confirm(`Delete ${item.name || item.staff_code}?`)) return;
    try {
      await deleteStaffMember(item._id || item.staff_code);
      setMessage("Surveyor deleted successfully.");
      setError("");
      await load();
    } catch (err) {
      setError(backendMessage(err));
    }
  }

  function view(item) {
    setSelected(item);
    setMode("view");
  }

  return (
    <div className="s3-stack">
      <section className="s3-card s3-surveyors-page">
        <header className="s3-surveyors-head">
          <div><h1>Surveyors</h1><p>Manage coverage zones, skills, availability, and workload.</p></div>
          <button type="button" onClick={openCreate}>+ Add Surveyor</button>
        </header>
        {message && <div className="s3-success">{message}</div>}
        {error && <div className="s3-error">{error}</div>}
        <div className="s3-table-scroll">
          <table className="s3-table s3-surveyors-table">
            <thead><tr><th>Name</th><th>Code</th><th>Zones</th><th>Skills</th><th>Workload</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{surveyors.map((item) => {
              const status = item.active === false ? "Inactive" : item.availability?.status === "on_leave" || item.availability?.active === false ? "On Leave" : "Active";
              return <tr key={item._id || item.staff_code}><td><strong>{item.name || item.full_name || "-"}</strong></td><td>{item.staff_code}</td><td><div className="s3-tag-list">{(item.zones || item.zone_ids || []).map((zone) => <span key={zone}>{zone}</span>)}</div></td><td>{(item.skills || []).map(readableMilestone).join(", ") || "-"}</td><td><b>{item.workload?.active_tasks || 0} / {item.workload?.max_tasks || 10}</b></td><td><span className={`s3-staff-status ${status.toLowerCase().replace(" ", "-")}`}>{status}</span></td><td><div className="s3-manager-actions"><button title="View surveyor" onClick={() => view(item)}>View</button><button title="Edit surveyor" onClick={() => openEdit(item)}>Edit</button><button className="delete" title="Delete surveyor" onClick={() => remove(item)}>Delete</button></div></td></tr>;
            })}</tbody>
          </table>
        </div>
        <footer>Showing {surveyors.length} surveyor{surveyors.length === 1 ? "" : "s"}</footer>
      </section>
      {mode && <div className="s3-modal-backdrop" onMouseDown={() => setMode("")}>
        <section className="s3-staff-modal" onMouseDown={(event) => event.stopPropagation()}>
          <header><h2>{mode === "create" ? "Add Surveyor" : mode === "edit" ? "Edit Surveyor" : "Surveyor Details"}</h2><button type="button" onClick={() => setMode("")}>x</button></header>
          {mode === "view" ? <div className="s3-staff-view"><dl><dt>Name</dt><dd>{selected.name}</dd><dt>Code</dt><dd>{selected.staff_code}</dd><dt>Email</dt><dd>{selected.contacts?.email || "-"}</dd><dt>Phone</dt><dd>{selected.contacts?.phone || "-"}</dd><dt>Coverage Zones</dt><dd>{(selected.zones || []).join(", ")}</dd><dt>Skills</dt><dd>{(selected.skills || []).map(readableMilestone).join(", ")}</dd><dt>Active Tasks</dt><dd>{selected.workload?.active_tasks || 0}</dd></dl><button type="button" onClick={() => openEdit(selected)}>Edit Surveyor</button></div> :
            <form onSubmit={save} className="s3-staff-form">
              <label>Surveyor Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
              <label>Surveyor Code<input value={form.staff_code} disabled={mode === "edit"} onChange={(event) => setForm({ ...form, staff_code: event.target.value })} required /></label>
              <label>Coverage Zones<input placeholder="Z-01, Z-02" value={form.zones} onChange={(event) => setForm({ ...form, zones: event.target.value })} required /></label>
              <label>Skills<input placeholder="GPS, Boundary Survey, Mapping" value={form.skills} onChange={(event) => setForm({ ...form, skills: event.target.value })} /></label>
              <label>Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
              <label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
              <label>Maximum Tasks<input type="number" min="1" value={form.max_tasks} onChange={(event) => setForm({ ...form, max_tasks: event.target.value })} /></label>
              <label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="active">Active</option><option value="on_leave">On Leave</option><option value="inactive">Inactive</option></select></label>
              <div><button type="button" className="secondary" onClick={() => setMode("")}>Cancel</button><button type="submit">Save</button></div>
            </form>}
        </section>
      </div>}
    </div>
  );
}

const emptyRegistrar = {
  staff_code: "",
  name: "",
  department: "Land Registration",
  phone: "",
  email: "",
  status: "active",
};

export function Student3RegistrarsPage() {
  const [registrars, setRegistrars] = useState([]);
  const [applications, setApplications] = useState([]);
  const [form, setForm] = useState(emptyRegistrar);
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const [staffData, applicationData] = await Promise.all([
        getStaffMembers("registrar"),
        getApplications({ limit: 200 }),
      ]);
      setRegistrars(itemsOf(staffData));
      setApplications(itemsOf(applicationData));
      setError("");
    } catch (err) {
      setError(backendMessage(err));
    }
  }

  useEffect(() => { load(); }, []);

  function edit(item) {
    setSelected(item);
    setForm({
      staff_code: item.staff_code || "",
      name: item.name || item.full_name || "",
      department: item.department || "Land Registration",
      phone: item.contacts?.phone || "",
      email: item.contacts?.email || "",
      status: item.active === false ? "inactive" : "active",
    });
    setMode("edit");
  }

  async function save(event) {
    event.preventDefault();
    if (!form.name.trim() || !form.staff_code.trim() || !form.department.trim()) {
      setError("Full name, registrar code, and department are required.");
      return;
    }
    const payload = {
      name: form.name.trim(),
      department: form.department.trim(),
      contacts: { email: form.email.trim(), phone: form.phone.trim() },
      active: form.status === "active",
      availability: { active: form.status === "active", status: form.status },
    };
    try {
      if (mode === "create") {
        await createStaffMember({
          ...payload,
          staff_code: form.staff_code.trim(),
          role: "registrar",
          zones: ["ALL"],
          zone_ids: ["ALL"],
          skills: ["legal_review", "document_verification"],
        });
        setMessage("Registrar added successfully.");
      } else {
        await updateStaffMember(selected._id || selected.staff_code, payload);
        setMessage("Registrar updated successfully.");
      }
      setMode("");
      setError("");
      await load();
    } catch (err) {
      setError(backendMessage(err));
    }
  }

  async function remove(item) {
    if (!window.confirm(`Are you sure you want to delete ${item.name || item.staff_code}?`)) return;
    try {
      await deleteStaffMember(item._id || item.staff_code);
      setMessage("Registrar deleted successfully.");
      setError("");
      await load();
    } catch (err) {
      setError(backendMessage(err));
    }
  }

  function performance(item) {
    const id = item._id || item.staff_code;
    const reviewed = applications.filter((app) => app.assignment?.assigned_registrar === id || app.assigned_registrar === id || app.registrar_review?.actor?.id === id);
    return {
      reviewed: reviewed.length,
      approved: reviewed.filter((app) => ["approved", "certificate_issued", "closed"].includes(app.status)).length,
      rejected: reviewed.filter((app) => app.status === "rejected").length,
    };
  }

  return <div className="s3-stack">
    <section className="s3-card s3-surveyors-page">
      <header className="s3-surveyors-head"><div><h1>Registrars</h1><p>Manage legal review staff, departments, and account status.</p></div><button type="button" onClick={() => { setForm(emptyRegistrar); setSelected(null); setMode("create"); }}>+ Add Registrar</button></header>
      {message && <div className="s3-success">{message}</div>}
      {error && <div className="s3-error">{error}</div>}
      <div className="s3-table-scroll"><table className="s3-table s3-surveyors-table"><thead><tr><th>Name</th><th>Code</th><th>Department</th><th>Email</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {registrars.map((item) => <tr key={item._id || item.staff_code}><td><strong>{item.name || item.full_name}</strong></td><td>{item.staff_code}</td><td>{item.department || "Land Registration"}</td><td>{item.contacts?.email || "-"}</td><td><span className={`s3-staff-status ${item.active === false ? "inactive" : "active"}`}>{item.active === false ? "Inactive" : "Active"}</span></td><td><div className="s3-manager-actions"><button onClick={() => { setSelected(item); setMode("view"); }}>View</button><button onClick={() => edit(item)}>Edit</button><button className="delete" onClick={() => remove(item)}>Delete</button></div></td></tr>)}
      </tbody></table></div>
      <footer>Showing {registrars.length} registrar{registrars.length === 1 ? "" : "s"}</footer>
    </section>
    {mode && <div className="s3-modal-backdrop" onMouseDown={() => setMode("")}><section className="s3-staff-modal" onMouseDown={(event) => event.stopPropagation()}>
      <header><h2>{mode === "create" ? "Add Registrar" : mode === "edit" ? "Edit Registrar" : "Registrar Details"}</h2><button type="button" onClick={() => setMode("")}>x</button></header>
      {mode === "view" ? (() => {
        const stats = performance(selected);
        return <div className="s3-staff-view"><dl><dt>Full Name</dt><dd>{selected.name}</dd><dt>Registrar Code</dt><dd>{selected.staff_code}</dd><dt>Department</dt><dd>{selected.department || "Land Registration"}</dd><dt>Email</dt><dd>{selected.contacts?.email || "-"}</dd><dt>Phone</dt><dd>{selected.contacts?.phone || "-"}</dd><dt>Applications Reviewed</dt><dd>{stats.reviewed}</dd><dt>Approved</dt><dd>{stats.approved}</dd><dt>Rejected</dt><dd>{stats.rejected}</dd></dl><button type="button" onClick={() => edit(selected)}>Edit Registrar</button></div>;
      })() : <form className="s3-staff-form" onSubmit={save}>
        <label>Full Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
        <label>Registrar Code<input value={form.staff_code} disabled={mode === "edit"} onChange={(event) => setForm({ ...form, staff_code: event.target.value })} required /></label>
        <label>Department<select value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })}><option>Land Registration</option><option>Legal Affairs</option><option>Certificate Office</option><option>Objections Unit</option></select></label>
        <label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label>Phone Number<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
        <label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        <div><button type="button" className="secondary" onClick={() => setMode("")}>Cancel</button><button type="submit">Save</button></div>
      </form>}
    </section></div>}
  </div>;
}

export function Student3AssignmentsPage() {
  const [tasks, setTasks] = useState([]);
  const [applications, setApplications] = useState([]);
  const [surveyors, setSurveyors] = useState([]);
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState("");
  const [selectedTask, setSelectedTask] = useState("");
  const [selectedApplication, setSelectedApplication] = useState("");
  const [selectedSurveyor, setSelectedSurveyor] = useState("");
  const [reason, setReason] = useState("Workload balancing");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const pageSize = 5;

  async function load() {
    try {
      const [taskData, appData, staffData] = await Promise.all([
        getSurveyTasks(),
        getApplications({ limit: 200 }),
        getStaffMembers("surveyor"),
      ]);
      setTasks(itemsOf(taskData));
      setApplications(itemsOf(appData));
      setSurveyors(itemsOf(staffData));
      setError("");
    } catch (err) {
      setError(backendMessage(err));
    }
  }

  useEffect(() => { load(); }, []);

  const assignedApplicationIds = new Set(tasks.map(taskApplicationId));
  const waitingApplications = applications.filter((app) => app.status === "survey_required" && !assignedApplicationIds.has(app.application_id));
  const totalPages = Math.max(1, Math.ceil(tasks.length / pageSize));
  const visible = tasks.slice((page - 1) * pageSize, page * pageSize);

  function surveyorName(id) {
    const item = surveyors.find((surveyor) => surveyor._id === id || surveyor.staff_code === id);
    return item?.name || item?.full_name || "Unassigned";
  }

  async function autoAssign() {
    if (!selectedApplication) {
      setError("Select a survey-required application.");
      return;
    }
    try {
      await autoAssignSurveyor(selectedApplication);
      setMessage(`${selectedApplication} assigned successfully using zone, skills, availability, and workload.`);
      setMode("");
      setError("");
      await load();
    } catch (err) {
      setError(backendMessage(err));
    }
  }

  function openReassign(task = null) {
    const target = task || tasks.find((item) => (item._id || item.task_id) === selectedTask) || tasks[0];
    setSelectedTask(target?._id || target?.task_id || "");
    setSelectedSurveyor("");
    setReason("Workload balancing");
    setMode("reassign");
  }

  async function reassign() {
    if (!selectedTask || !selectedSurveyor) {
      setError("Select a task and a new surveyor.");
      return;
    }
    try {
      await reassignSurveyTask(selectedTask, { surveyor_id: selectedSurveyor, reason });
      setMessage("Survey task reassigned successfully.");
      setMode("");
      setError("");
      await load();
    } catch (err) {
      setError(backendMessage(err));
    }
  }

  const reassignTask = tasks.find((item) => (item._id || item.task_id) === selectedTask);
  const eligibleSurveyors = surveyors.filter((surveyor) => {
    const zones = surveyor.zones || surveyor.zone_ids || [];
    const zone = reassignTask?.zone_id || reassignTask?.parcel_ref?.zone_id;
    return surveyor.active !== false && surveyor.availability?.active !== false && (zones.includes(zone) || zones.includes("ALL"));
  });

  return <div className="s3-stack">
    <section className="s3-card s3-surveyors-page s3-assignments-page">
      <header className="s3-surveyors-head"><div><h1>Assignments</h1><p>Assign and monitor survey field tasks.</p></div><div className="s3-assignment-head-actions"><button type="button" onClick={() => { setSelectedApplication(waitingApplications[0]?.application_id || ""); setMode("auto"); }}>Auto Assign</button><button type="button" className="outline" onClick={() => openReassign()}>Reassign</button></div></header>
      {message && <div className="s3-success">{message}</div>}
      {error && <div className="s3-error">{error}</div>}
      <div className="s3-table-scroll"><table className="s3-table s3-surveyors-table"><thead><tr><th>Application ID</th><th>Parcel Number</th><th>Zone</th><th>Priority</th><th>Assigned To</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {visible.map((task) => <tr key={task._id || task.task_id}><td><Link to={`/student2/staff/applications/${taskApplicationId(task)}`}>{taskApplicationId(task)}</Link></td><td>{task.parcel_number || task.parcel_ref?.parcel_number || "-"}</td><td>{task.zone_id || task.parcel_ref?.zone_id || "-"}</td><td><span className={`s3-priority ${(task.priority || "normal").toLowerCase()}`}>{task.priority || "Normal"}</span></td><td>{surveyorName(task.assigned_surveyor)}</td><td><span className={`s3-milestone-label ${statusTone(task.current_milestone || task.status)}`}>{readableMilestone(task.current_milestone || task.status)}</span></td><td><div className="s3-manager-actions"><Link to={`/student3/execution/${taskApplicationId(task)}`}>View</Link><button onClick={() => openReassign(task)}>Reassign</button></div></td></tr>)}
      </tbody></table></div>
      {!tasks.length && <div className="s3-no-data">No survey assignments found.</div>}
      <footer className="s3-assignment-footer"><span>Showing {tasks.length ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, tasks.length)} of {tasks.length} assignments</span><div><button disabled={page === 1} onClick={() => setPage(page - 1)}>‹</button>{Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => <button className={page === number ? "active" : ""} onClick={() => setPage(number)} key={number}>{number}</button>)}<button disabled={page === totalPages} onClick={() => setPage(page + 1)}>›</button></div></footer>
    </section>
    {mode && <div className="s3-modal-backdrop" onMouseDown={() => setMode("")}><section className="s3-staff-modal s3-assignment-modal" onMouseDown={(event) => event.stopPropagation()}>
      <header><h2>{mode === "auto" ? "Auto Assign Surveyor" : "Reassign Survey Task"}</h2><button type="button" onClick={() => setMode("")}>x</button></header>
      {mode === "auto" ? <div className="s3-assignment-form"><p>The system selects the best surveyor using zone match, required skills, availability, and lowest workload.</p><label>Survey Required Application<select value={selectedApplication} onChange={(event) => setSelectedApplication(event.target.value)}><option value="">Select application</option>{waitingApplications.map((app) => <option key={app.application_id} value={app.application_id}>{app.application_id} - {app.parcel_ref?.parcel_number || "Parcel"} - {app.parcel_ref?.zone_id || "Zone"}</option>)}</select></label>{!waitingApplications.length && <div className="s3-no-data">All survey-required applications are already assigned.</div>}<div><button className="secondary" onClick={() => setMode("")}>Cancel</button><button onClick={autoAssign} disabled={!waitingApplications.length}>Auto Assign</button></div></div> :
        <div className="s3-assignment-form"><label>Survey Task<select value={selectedTask} onChange={(event) => { setSelectedTask(event.target.value); setSelectedSurveyor(""); }}><option value="">Select task</option>{tasks.map((task) => <option key={task._id || task.task_id} value={task._id || task.task_id}>{task.task_id} - {taskApplicationId(task)}</option>)}</select></label><label>New Surveyor<select value={selectedSurveyor} onChange={(event) => setSelectedSurveyor(event.target.value)}><option value="">Select eligible surveyor</option>{eligibleSurveyors.map((surveyor) => <option key={surveyor._id} value={surveyor._id}>{surveyor.name} ({surveyor.workload?.active_tasks || 0}/{surveyor.workload?.max_tasks || 10})</option>)}</select></label><label>Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} /></label><div><button className="secondary" onClick={() => setMode("")}>Cancel</button><button onClick={reassign}>Save Reassignment</button></div></div>}
    </section></div>}
  </div>;
}

export function Student3RegistrarReviewPage() {
  const [reports, setReports] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [decision, setDecision] = useState("approve");
  const [note, setNote] = useState("Report is complete and accurate.\nAll boundaries verified. Approved.");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const data = await getSurveyReports();
      const rows = itemsOf(data);
      setReports(rows);
      setSelectedId((current) => current || rows.find((item) => item.registrar_review_status === "pending")?._id || rows[0]?._id || "");
      setError("");
    } catch (err) {
      setError(backendMessage(err));
    }
  }

  useEffect(() => { load(); }, []);
  const report = reports.find((item) => item._id === selectedId);
  const task = report?.task || {};
  const applicationId = report?.application_number || taskApplicationId(task);

  async function submit(targetDecision) {
    if (!report) {
      setError("Select a survey report first.");
      return;
    }
    if (targetDecision === "reject" && !note.trim()) {
      setError("Please enter rejection reason.");
      return;
    }
    try {
      await reviewSurveyReport(applicationId, { decision: targetDecision, note: note.trim() });
      setMessage(targetDecision === "approve" ? "Survey Report Approved Successfully." : "Survey report rejected and returned to the surveyor.");
      setError("");
      await load();
    } catch (err) {
      setError(backendMessage(err));
    }
  }

  return <div className="s3-stack">
    <section className="s3-card s3-registrar-review-page">
      <header className="s3-review-head"><div><h1>Registrar Review</h1><p>Review uploaded survey reports before workflow approval.</p></div><label>Survey Report<select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setMessage(""); setError(""); }}><option value="">Select report</option>{reports.map((item) => <option key={item._id} value={item._id}>{item.application_number} - {readableMilestone(item.report_type || "survey_report")}</option>)}</select></label></header>
      {message && <div className="s3-success">{message}</div>}
      {error && <div className="s3-error">{error}</div>}
      {report ? <div className="s3-review-grid">
        <article>
          <h2>Application Information</h2>
          <dl><dt>Application ID</dt><dd>{applicationId}</dd><dt>Parcel Number</dt><dd>{task.parcel_number || task.parcel_ref?.parcel_number || "-"}</dd><dt>Zone</dt><dd>{task.zone_id || task.parcel_ref?.zone_id || "-"}</dd><dt>Surveyor</dt><dd>{report.surveyor_name || "-"}</dd><dt>Milestone</dt><dd><span className="s3-staff-status on-leave">{readableMilestone(task.current_milestone || "report_uploaded")}</span></dd></dl>
        </article>
        <article>
          <h2>Survey Report</h2>
          <dl><dt>Report Type</dt><dd>{readableMilestone(report.report_type || "field_survey")}</dd><dt>Survey Method</dt><dd>{report.findings?.measured_by || report.findings?.survey_method || "GNSS + Total Station"}</dd><dt>File</dt><dd><span>{report.file_name || "survey_report.pdf"}</span>{report.file_url && <a className="s3-download-report" href={`${API_BASE_URL}${report.file_url}`} target="_blank" rel="noreferrer">Download</a>}</dd><dt>Description</dt><dd className="description">{report.summary || "No report description provided."}</dd></dl>
        </article>
        <article className="s3-review-decision">
          <h2>Review Decision</h2>
          <label>Decision<select value={decision} onChange={(event) => setDecision(event.target.value)}><option value="approve">Approve</option><option value="reject">Reject</option></select></label>
          <label>Internal Notes<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={decision === "reject" ? "Enter rejection reason..." : "Add registrar review notes..."} /></label>
          <div><button className="approve" type="button" onClick={() => submit("approve")}>Approve</button><button className="reject" type="button" onClick={() => submit("reject")}>Reject</button></div>
        </article>
      </div> : <div className="s3-no-data">No survey reports are available for registrar review.</div>}
    </section>
  </div>;
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
