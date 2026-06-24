const API = "http://127.0.0.1:8004";
const root = document.getElementById("root");
let currentPage = localStorage.getItem("role") || "Login";
let apps = [];
let kpis = {};
let statuses = [];
let zones = [];
let tasks = [];
let parcels = { features: [] };
let notice = "";
let wizardStep = 0;
let selectedApplicationId = localStorage.getItem("selectedApplicationId") || "";
let detailTab = "Overview";
let drawnCoordinates = [[35.202, 31.902], [35.203, 31.902], [35.203, 31.903], [35.202, 31.903], [35.202, 31.902]];
let confirmationId = "";

const workflowStates = [
  "submitted",
  "pre_checked",
  "survey_required",
  "surveyed",
  "legal_review",
  "approved",
  "certificate_issued",
  "closed",
];

async function request(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Request failed");
  return data;
}

function show(message) {
  notice = message;
  render();
  setTimeout(() => {
    notice = "";
    render();
  }, 4500);
}

async function loadData() {
  try {
    const [appRes, kpiRes, statusRes, zoneRes, taskRes, parcelRes] = await Promise.all([
      request("/applications/"),
      request("/analytics/kpis"),
      request("/analytics/applications-by-status"),
      request("/analytics/applications-by-zone"),
      request("/survey-tasks"),
      request("/analytics/geofeeds/parcels"),
    ]);
    apps = appRes.items || [];
    kpis = kpiRes || {};
    statuses = statusRes || [];
    zones = zoneRes || [];
    tasks = taskRes || [];
    parcels = parcelRes || { features: [] };
  } catch (error) {
    show("Backend is not reachable. Make sure http://127.0.0.1:8004/docs is running.");
  }
  render();
}

async function seedData() {
  try {
    await request("/seed", { method: "POST" });
    show("Sample data inserted");
    await loadData();
  } catch (error) {
    show(error.message);
  }
}

async function submitApplication() {
  const national = String(Date.now()).slice(-9);
  const payload = {
    application_type: document.getElementById("application_type").value,
    applicant: {
      full_name: document.getElementById("full_name").value || "Nour Ahmad",
      applicant_type: "citizen",
      national_id: national,
      phone: "+970599000001",
      email: `nour${national}@example.com`,
      city: "Ramallah",
      neighborhood: "Al Tireh",
      zone_id: "ZONE-RM-01",
    },
    parcel: {
      parcel_number: String(140 + apps.length + 1),
      block_number: "12",
      basin_number: "3",
      zone_id: "ZONE-RM-01",
      area_sqm: 850.5,
      land_use: "residential",
      geometry: {
        type: "Polygon",
        coordinates: [[[35.202, 31.902], [35.203, 31.902], [35.203, 31.903], [35.202, 31.903], [35.202, 31.902]]],
      },
    },
    documents: [
      { document_type: "ownership_deed", file_name: "deed.pdf", file_url: "/uploads/deed.pdf", status: "pending_review" },
      { document_type: "id_copy", file_name: "id.pdf", file_url: "/uploads/id.pdf", status: "pending_review" },
    ],
  };
  try {
    const app = await request("/applications/", {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify(payload),
    });
    confirmationId = app.application_id;
    selectedApplicationId = app.application_id;
    localStorage.setItem("selectedApplicationId", app.application_id);
    show(`Application submitted: ${app.application_id}`);
    await loadData();
    setPage("Confirmation");
  } catch (error) {
    show(error.message);
  }
}

async function changeStatus(id, status) {
  if (!status) return;
  try {
    await request(`/applications/${id}/transition`, {
      method: "PATCH",
      body: JSON.stringify({ new_status: status, note: `Moved to ${status}` }),
    });
    show(`Moved to ${status}`);
    await loadData();
  } catch (error) {
    show(error.message);
  }
}

async function assignSurveyor(id) {
  try {
    const result = await request(`/applications/${id}/auto-assign-surveyor`, { method: "POST" });
    show(`Surveyor assigned: ${result.surveyor.name}`);
    await loadData();
  } catch (error) {
    show(error.message);
  }
}

async function nextMilestone(task) {
  const next = {
    assigned: "visit_scheduled",
    visit_scheduled: "arrived_on_site",
    arrived_on_site: "survey_started",
    survey_started: "survey_completed",
    survey_completed: "report_uploaded",
  }[task.status] || "visit_scheduled";
  try {
    await request(`/applications/${task.application_id}/survey-milestone`, {
      method: "PATCH",
      body: JSON.stringify({ milestone: next, note: "Updated from frontend" }),
    });
    show(`Task moved to ${next}`);
    await loadData();
  } catch (error) {
    show(error.message);
  }
}

async function uploadReport(task) {
  try {
    await request(`/applications/${task.application_id}/survey-report`, {
      method: "POST",
      body: JSON.stringify({
        summary: "Boundary verified successfully.",
        boundary_matches: true,
        area_sqm_measured: 850.5,
        has_dispute: false,
      }),
    });
    show("Survey report uploaded");
    await loadData();
  } catch (error) {
    show(error.message);
  }
}

async function registrarApprove(id) {
  try {
    await request(`/applications/${id}/registrar-review`, {
      method: "PATCH",
      body: JSON.stringify({ decision: "approved", note: "All legal documents verified" }),
    });
    show("Application approved");
    await loadData();
  } catch (error) {
    show(error.message);
  }
}

async function generateCertificate(id) {
  try {
    const cert = await request(`/applications/${id}/certificate`, { method: "POST" });
    show(`Certificate generated: ${cert.certificate_id}`);
    await loadData();
  } catch (error) {
    show(error.message);
  }
}

function setPage(page) {
  currentPage = page;
  localStorage.setItem("role", page);
  render();
}

function selectApplication(id, page = "Track") {
  selectedApplicationId = id;
  localStorage.setItem("selectedApplicationId", id);
  setPage(page);
}

function selectedApp() {
  return apps.find((app) => app.application_id === selectedApplicationId) || apps[0] || null;
}

function setWizardStep(step) {
  wizardStep = Math.max(0, Math.min(5, step));
  render();
}

function setDetailTab(tab) {
  detailTab = tab;
  render();
}

function metric(label, value) {
  const initials = label.split(" ").map((word) => word[0]).join("").slice(0, 2);
  return `<div class="card"><div class="card-label">${label}</div><div class="metric-row"><div class="metric">${value}</div><div class="metric-icon">${initials}</div></div></div>`;
}

function pageIntro(title, subtitle) {
  return `<div><div class="page-kicker">${subtitle}</div><h1>${title}</h1></div>`;
}

function workflowStepper(activeIndex = 0) {
  const steps = ["Application Type", "Applicant Info", "Parcel Info", "Location on Map", "Documents", "Review & Submit"];
  return `<div class="stepper">${steps.map((step, index) => `<div class="wizard-step ${index < activeIndex ? "done" : ""} ${index === activeIndex ? "active" : ""}"><b>${index + 1}</b><span>${step}</span></div>`).join("")}</div>`;
}

function table(rows, actions = "") {
  return `
    <div class="panel">
      <div class="panel-head"><h2>Applications</h2><div class="toolbar"><input class="table-search" placeholder="Search applications..." /><select><option>All Status</option><option>submitted</option><option>legal_review</option><option>approved</option></select><button class="btn secondary">Export</button></div></div>
      <table>
        <thead>
          <tr><th>ID</th><th>Applicant</th><th>Type</th><th>Parcel</th><th>Zone</th><th>Status</th><th>Workflow</th><th>Actions</th></tr>
        </thead>
        <tbody>
          ${rows.map((app) => `
            <tr>
              <td>${app.application_id}</td>
              <td>${app.applicant_ref?.full_name || ""}</td>
              <td>${app.application_type}</td>
              <td>${app.parcel_ref?.parcel_number || ""}</td>
              <td>${app.parcel_ref?.zone_id || ""}</td>
              <td><span class="status ${app.status}">${app.status}</span></td>
              <td><div class="timeline">${workflowStates.map((state) => `<span class="step ${workflowStates.indexOf(state) <= workflowStates.indexOf(app.status) ? "done" : ""}">${state}</span>`).join("")}</div></td>
              <td class="toolbar">${actionsFor(app, actions)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function actionsFor(app, type) {
  if (type === "staff") {
    return `
      <select onchange="changeStatus('${app.application_id}', this.value)">
        <option value="">Change status</option>
        ${(app.workflow?.allowed_next || []).map((status) => `<option value="${status}">${status}</option>`).join("")}
      </select>
      <button class="btn secondary" onclick="assignSurveyor('${app.application_id}')">Assign Surveyor</button>
    `;
  }
  if (type === "registrar") {
    return `
      <button class="btn secondary" onclick="registrarApprove('${app.application_id}')">Approve</button>
      <button class="btn" onclick="generateCertificate('${app.application_id}')">Generate Certificate</button>
    `;
  }
  return `<button class="btn secondary" onclick="selectApplication('${app.application_id}', 'Track')">Track</button><button class="btn secondary" onclick="selectApplication('${app.application_id}', 'Details')">Details</button>`;
}

function applicantPage() {
  return `
    <div class="dashboard-head">
      <div>
        <h2>Focus to Solve</h2>
      </div>
      <div class="user-chip"><span>AM</span><div><b>Ahmed Al-Samman</b><small>Citizen</small></div></div>
    </div>
    <div class="applicant-metrics">
      ${dashMetric("Total Applications", apps.length || 12, "blue")}
      ${dashMetric("Pending", apps.filter((a) => ["submitted", "pre_checked"].includes(a.status)).length || 5, "orange")}
      ${dashMetric("Approved", apps.filter((a) => ["approved", "certificate_issued", "closed"].includes(a.status)).length || 4, "green")}
      ${dashMetric("Objections", apps.filter((a) => a.status === "under_objection").length || 2, "red")}
      ${dashMetric("Under Review", apps.filter((a) => ["legal_review", "surveyed"].includes(a.status)).length || 1, "purple")}
      ${dashMetric("Survey in Progress", tasks.filter((t) => !t.report_uploaded).length || 3, "sky")}
      ${dashMetric("Certificates Ready", apps.filter((a) => a.status === "certificate_issued").length || 1, "cyan")}
    </div>
    <div class="toolbar" style="margin-bottom:14px">
      <button class="btn" onclick="setWizardStep(0)">Submit New Application</button>
      <button class="btn secondary" onclick="setPage('Track')">Track Application</button>
      <button class="btn secondary" onclick="setPage('Documents')">My Documents</button>
      <button class="btn secondary" onclick="setPage('Objection')">Submit Objection</button>
    </div>
    <div class="panel">
      <div class="panel-head"><h2>Submit New Application</h2><button class="btn secondary" onclick="setWizardStep(0)">Reset Wizard</button></div>
      ${workflowStepper(wizardStep)}
      ${wizardBody()}
      <div class="toolbar" style="margin-top:12px">
        <button class="btn secondary" onclick="setWizardStep(wizardStep - 1)" ${wizardStep === 0 ? "disabled" : ""}>Back</button>
        ${wizardStep < 5 ? `<button class="btn" onclick="setWizardStep(wizardStep + 1)">Next</button>` : `<button class="btn" onclick="submitApplication()">Submit Application</button>`}
      </div>
    </div>
    ${applicantApplicationsTable()}
  `;
}

function dashMetric(label, value, color) {
  return `
    <div class="dash-card ${color}">
      <div class="dash-icon">${label.split(" ").map((word) => word[0]).join("").slice(0, 2)}</div>
      <div>
        <small>${label}</small>
        <strong>${value}</strong>
      </div>
    </div>
  `;
}

function applicantApplicationsTable() {
  const rows = apps.length ? apps : [
    { application_id: "LRMIS-2026-0001", application_type: "Ownership Transfer", parcel_ref: { parcel_number: "145" }, status: "pre_checked", timestamps: { submitted_at: "2026-01-01" } },
    { application_id: "LRMIS-2026-0002", application_type: "First Registration", parcel_ref: { parcel_number: "210" }, status: "survey_required", timestamps: { submitted_at: "2026-05-31" } },
    { application_id: "LRMIS-2026-0003", application_type: "Parcel Subdivision", parcel_ref: { parcel_number: "88" }, status: "legal_review", timestamps: { submitted_at: "2026-05-29" } },
    { application_id: "LRMIS-2026-0004", application_type: "Certificate Request", parcel_ref: { parcel_number: "145" }, status: "approved", timestamps: { submitted_at: "2026-05-20" } },
  ];
  return `
    <div class="app-table-panel">
      <div class="panel-head"><h2>My Applications</h2><button class="view-all">View All</button></div>
      <table class="clean-table">
        <thead><tr><th>Application ID</th><th>Type</th><th>Parcel No.</th><th>Status</th><th>Submitted Date</th><th>Next Step</th></tr></thead>
        <tbody>${rows.map((app) => `
          <tr>
            <td>${app.application_id}</td>
            <td>${app.application_type}</td>
            <td>${app.parcel_ref?.parcel_number || "-"}</td>
            <td><span class="status ${app.status}">${app.status}</span></td>
            <td>${(app.timestamps?.submitted_at || "").slice(0, 10) || "2026-06-01"}</td>
            <td>${nextStepLabel(app.status)}</td>
          </tr>
        `).join("")}</tbody>
      </table>
    </div>
  `;
}

function nextStepLabel(status) {
  return {
    submitted: "Waiting for pre-check",
    pre_checked: "Waiting for survey assignment",
    survey_required: "Survey visit scheduled",
    surveyed: "Under legal review",
    legal_review: "Registrar decision pending",
    approved: "Certificate generation",
    certificate_issued: "Certificate ready",
    closed: "Completed",
    under_objection: "Objection review",
    missing_documents: "Upload missing documents",
    rejected: "Rejected",
  }[status] || "Waiting for review";
}

function confirmationPage() {
  const app = apps.find((item) => item.application_id === confirmationId) || selectedApp();
  if (!app) return `<div class="empty">No submitted application yet.</div>`;
  return `
    <div class="panel confirmation">
      <div class="success-mark">OK</div>
      <h2>Your application has been submitted successfully</h2>
      <h1>${app.application_id}</h1>
      <p>Status: <span class="status ${app.status}">${app.status}</span></p>
      <p>Next step: waiting for staff pre-check.</p>
      <div class="toolbar center"><button class="btn" onclick="selectApplication('${app.application_id}', 'Track')">Track Application</button><button class="btn secondary" onclick="setPage('Applicant')">Go to Dashboard</button></div>
    </div>
    <div class="certificate">
      <div class="panel"><h3>Uploaded Documents</h3>${(app.required_documents || []).map((doc) => `<p>${doc.status !== "missing" ? "OK" : "--"} ${doc.document_type}</p>`).join("")}</div>
      <div class="panel"><h3>Parcel Location</h3><div class="mini-map">GeoJSON polygon saved</div></div>
    </div>
  `;
}

function wizardBody() {
  if (wizardStep === 0) return `<div class="form-grid"><label>Application Type<select id="application_type"><option>ownership_transfer</option><option>first_registration</option><option>parcel_subdivision</option><option>parcel_merge</option><option>boundary_correction</option><option>certificate_request</option></select></label></div>`;
  if (wizardStep === 1) return `<div class="form-grid"><label>Full Name<input id="full_name" value="Nour Ahmad" /></label><label>National ID<input value="400000001" /></label><label>Phone<input value="+970599000001" /></label><label>Email<input value="nour@example.com" /></label><label>Address<input value="Ramallah - Al Tireh" /></label><label>Preferred Language<select><option>Arabic</option><option>English</option></select></label></div>`;
  if (wizardStep === 2) return `<div class="form-grid"><label>Parcel Number<input value="145" /></label><label>Block Number<input value="12" /></label><label>Basin Number<input value="3" /></label><label>Zone<input value="ZONE-RM-01" /></label><label>Area sqm<input value="850.5" /></label><label>Land Use<select><option>residential</option><option>commercial</option></select></label></div>`;
  if (wizardStep === 3) {
    setTimeout(drawWizardMap, 0);
    return `<div class="map-layout"><div><div id="wizard-map"></div></div><aside class="map-filters"><h3>GeoJSON Preview</h3><textarea rows="10" readonly>${JSON.stringify({ type: "Polygon", coordinates: [drawnCoordinates] }, null, 2)}</textarea><button class="btn secondary" onclick="resetDrawnPolygon()">Reset Polygon</button></aside></div>`;
  }
  if (wizardStep === 4) return `<table><thead><tr><th>Document Type</th><th>Upload File</th><th>Status</th></tr></thead><tbody>${["ownership_deed", "id_copy", "sale_contract", "survey_report"].map((doc, i) => `<tr><td>${doc}</td><td><input type="file" /></td><td><span class="status ${i < 2 ? "approved" : "missing_documents"}">${i < 2 ? "pending_review" : "missing"}</span></td></tr>`).join("")}</tbody></table>`;
  return `<div class="certificate"><div class="panel"><h3>Review Summary</h3><p><b>Type:</b> ownership_transfer</p><p><b>Applicant:</b> Nour Ahmad</p><p><b>Parcel:</b> 145 / Block 12 / Basin 3</p><p><b>Status after submit:</b> submitted</p></div><div class="panel"><h3>Validation</h3><p>Applicant data complete</p><p>Parcel GeoJSON ready</p><p>Required documents prepared</p></div></div>`;
}

function resetDrawnPolygon() {
  drawnCoordinates = [[35.202, 31.902], [35.203, 31.902], [35.203, 31.903], [35.202, 31.903], [35.202, 31.902]];
  render();
}

function drawWizardMap() {
  const el = document.getElementById("wizard-map");
  if (!el || !window.L) return;
  el.style.height = "360px";
  const map = L.map("wizard-map").setView([31.9026, 35.2025], 17);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
  let layer = L.polygon(drawnCoordinates.map(([lng, lat]) => [lat, lng]), { color: "#0f62d6", fillOpacity: .25 }).addTo(map);
  map.fitBounds(layer.getBounds(), { padding: [24, 24] });
  map.on("click", (event) => {
    const coord = [Number(event.latlng.lng.toFixed(6)), Number(event.latlng.lat.toFixed(6))];
    drawnCoordinates.splice(drawnCoordinates.length - 1, 0, coord);
    drawnCoordinates[drawnCoordinates.length - 1] = drawnCoordinates[0];
    layer.setLatLngs(drawnCoordinates.map(([lng, lat]) => [lat, lng]));
  });
}

function staffPage() {
  return `
    <div class="grid">
      ${metric("Total Pending", apps.filter((a) => !["closed", "rejected"].includes(a.status)).length)}
      ${metric("Legal Review", apps.filter((a) => a.status === "legal_review").length)}
      ${metric("Under Objection", apps.filter((a) => a.status === "under_objection").length)}
      ${metric("Approved", apps.filter((a) => a.status === "approved").length)}
    </div>
    ${table(apps, "staff")}
  `;
}

function surveyorPage() {
  return `
    <div class="grid">
      ${metric("My Active Tasks", tasks.length)}
      ${metric("Scheduled Visits", tasks.filter((t) => t.status === "visit_scheduled").length)}
      ${metric("Completed Surveys", tasks.filter((t) => t.status === "survey_completed").length)}
      ${metric("Reports Pending", tasks.filter((t) => !t.report_uploaded).length)}
    </div>
    <div class="panel">
      <h2>Surveyor Tasks</h2>
      <table>
        <thead><tr><th>Task ID</th><th>Status</th><th>Priority</th><th>Scheduled</th><th>Action</th></tr></thead>
        <tbody>${tasks.map((task) => `
          <tr>
            <td>${task.task_id}</td><td><span class="status">${task.status}</span></td><td>${task.priority}</td><td>${task.scheduled_visit_date || "-"}</td>
            <td class="toolbar"><button class="btn secondary" onclick='nextMilestone(${JSON.stringify(task)})'>Next Milestone</button><button class="btn" onclick='uploadReport(${JSON.stringify(task)})'>Upload Report</button></td>
          </tr>`).join("")}</tbody>
      </table>
    </div>
  `;
}

function registrarPage() {
  return `
    <div class="grid">
      ${metric("Legal Review", apps.filter((a) => a.status === "legal_review").length)}
      ${metric("Approved", apps.filter((a) => a.status === "approved").length)}
      ${metric("Certificates Issued", apps.filter((a) => a.status === "certificate_issued").length)}
      ${metric("Closed", apps.filter((a) => a.status === "closed").length)}
    </div>
    <div class="panel">
      <div class="panel-head"><h2>Registrar Review</h2><button class="btn secondary">Request Re-upload</button></div>
      <div class="certificate">
        <div>${table(apps.filter((app) => ["legal_review", "approved", "certificate_issued"].includes(app.status)), "registrar")}</div>
        <div class="panel"><h3>Decision Panel</h3><label>Decision<select><option>Approve</option><option>Reject</option><option>Request Changes</option></select></label><label>Comment<textarea rows="5">Verified legal documents and no objections.</textarea></label></div>
      </div>
    </div>
  `;
}

function trackPage() {
  const app = selectedApp();
  if (!app) return `<div class="empty">No application selected. Go to Applicant and choose Track.</div>`;
  const missing = (app.required_documents || []).filter((doc) => doc.status === "missing");
  const task = tasks.find((item) => item.application_id === app._id);
  return `
    <div class="grid">
      ${metric("Current Status", app.status)}
      ${metric("Missing Documents", missing.length)}
      ${metric("Survey Status", task?.status || "not_assigned")}
      ${metric("Certificate", app.certificate?.status || "not_issued")}
    </div>
    <div class="panel">
      <div class="panel-head"><h2>Track Application ${app.application_id}</h2><button class="btn secondary" onclick="setPage('Documents')">Upload Missing Documents</button></div>
      <div class="timeline">${workflowStates.map((state) => `<span class="step ${workflowStates.indexOf(state) <= workflowStates.indexOf(app.status) ? "done" : ""}">${state}</span>`).join("")}</div>
    </div>
    <div class="certificate">
      <div class="panel"><h3>Missing Documents</h3>${missing.length ? missing.map((doc) => `<p>${doc.document_type} - <span class="status missing_documents">missing</span></p>`).join("") : "<p>All required documents are present.</p>"}</div>
      <div class="panel"><h3>Survey Status</h3><p>${task ? task.status : "No task assigned yet."}</p><p>Report uploaded: ${task?.report_uploaded ? "Yes" : "No"}</p></div>
    </div>
    <div class="toolbar"><button class="btn secondary" onclick="setPage('Objection')">Submit Objection</button><button class="btn" onclick="setPage('Registrar')">View Certificate</button></div>
  `;
}

function documentsPage() {
  const app = selectedApp();
  if (!app) return `<div class="empty">Select an application first.</div>`;
  return `
    <div class="panel">
      <h2>Upload Additional Documents</h2>
      <table><thead><tr><th>Document</th><th>Status</th><th>Upload</th><th>Action</th></tr></thead><tbody>
        ${(app.required_documents || []).map((doc) => `<tr><td>${doc.document_type}</td><td><span class="status ${doc.status === "missing" ? "missing_documents" : "approved"}">${doc.status}</span></td><td><input type="file" /></td><td><button class="btn secondary" onclick="uploadDemoDocument('${app.application_id}', '${doc.document_type}')">Upload</button></td></tr>`).join("")}
      </tbody></table>
    </div>
  `;
}

async function uploadDemoDocument(id, type) {
  try {
    await request(`/applications/${id}/documents`, {
      method: "POST",
      body: JSON.stringify({ document_type: type, file_name: `${type}.pdf`, file_url: `/uploads/${type}.pdf`, mime_type: "application/pdf", size: 204800 }),
    });
    show("Document uploaded successfully and waiting for review.");
    await loadData();
  } catch (error) {
    show(error.message);
  }
}

function objectionPage() {
  const app = selectedApp();
  if (!app) return `<div class="empty">Select an application first.</div>`;
  return `
    <div class="panel">
      <h2>Submit Objection</h2>
      <div class="form-grid"><label>Application ID<input value="${app.application_id}" readonly /></label><label>Objector Name<input id="objector_name" value="Ahmad Ali" /></label><label>Contact<input value="+970599444444" /></label></div>
      <label style="margin-top:12px">Reason<textarea id="objection_reason" rows="5">There is a dispute about ownership share.</textarea></label>
      <div class="toolbar" style="margin-top:12px"><button class="btn" onclick="submitDemoObjection('${app.application_id}')">Submit Objection</button></div>
    </div>
  `;
}

async function submitDemoObjection(id) {
  try {
    await request(`/applications/${id}/objections`, {
      method: "POST",
      body: JSON.stringify({ full_name: document.getElementById("objector_name").value, reason: document.getElementById("objection_reason").value, supporting_documents: [] }),
    });
    show("Your objection has been submitted.");
    await loadData();
  } catch (error) {
    show(error.message);
  }
}

function detailsPage() {
  const app = selectedApp();
  if (!app) return `<div class="empty">No application selected.</div>`;
  const tabs = ["Overview", "Documents", "Timeline", "Objections", "Internal Notes", "Audit Log"];
  const tabButtons = `<div class="toolbar">${tabs.map((tab) => `<button class="btn ${detailTab === tab ? "" : "secondary"}" onclick="setDetailTab('${tab}')">${tab}</button>`).join("")}</div>`;
  let body = "";
  if (detailTab === "Overview") body = `<div class="form-grid"><div class="panel"><h3>Applicant</h3><p>${app.applicant_ref?.full_name}</p><p>${app.applicant_ref?.email}</p></div><div class="panel"><h3>Parcel</h3><p>Parcel ${app.parcel_ref?.parcel_number}</p><p>${app.parcel_ref?.zone_id}</p></div><div class="panel"><h3>Status</h3><p><span class="status ${app.status}">${app.status}</span></p></div></div>`;
  if (detailTab === "Documents") body = `<table><thead><tr><th>Document</th><th>Required</th><th>Status</th></tr></thead><tbody>${(app.required_documents || []).map((doc) => `<tr><td>${doc.document_type}</td><td>${doc.required}</td><td><span class="status ${doc.status === "missing" ? "missing_documents" : "approved"}">${doc.status}</span></td></tr>`).join("")}</tbody></table>`;
  if (detailTab === "Timeline" || detailTab === "Audit Log") body = `<div class="timeline">${workflowStates.map((state) => `<span class="step ${workflowStates.indexOf(state) <= workflowStates.indexOf(app.status) ? "done" : ""}">${state}</span>`).join("")}</div>`;
  if (detailTab === "Objections") body = `<p>Objection state: ${app.objection?.has_objection ? "Has objection" : "None"}</p>`;
  if (detailTab === "Internal Notes") body = `<textarea rows="5">Internal staff notes and registrar remarks appear here.</textarea>`;
  return `<div class="panel"><div class="panel-head"><h2>Application Details - ${app.application_id}</h2><div class="toolbar"><button class="btn secondary" onclick="assignSurveyor('${app.application_id}')">Auto Assign Surveyor</button><button class="btn warn" onclick="changeStatus('${app.application_id}', 'rejected')">Reject</button></div></div>${tabButtons}${body}</div>`;
}

function mapPage() {
  return `
    <div class="panel">
      <div class="panel-head"><h2>Live Parcel Map</h2><button class="btn secondary" onclick="loadData()">Apply Filters</button></div>
      <div class="map-layout">
        <div>
          <div class="notice">Leaflet map loaded from MongoDB GeoJSON parcels feed.</div>
          <div id="map"></div>
        </div>
        <aside class="map-filters">
          <h3>Filters</h3>
          <label>Zone<select><option>All Zones</option><option>ZONE-RM-01</option></select></label>
          <label>Status<select><option>All Statuses</option><option>submitted</option><option>approved</option><option>certificate_issued</option></select></label>
          <label>Parcel Type<select><option>All Types</option><option>residential</option></select></label>
          <div class="legend">
            <b>Legend</b>
            <span>Submitted</span>
            <span>Approved</span>
            <span>Survey Required</span>
            <span>Objection</span>
          </div>
        </aside>
      </div>
      <table>
        <thead><tr><th>Parcel Code</th><th>Zone</th><th>Application</th><th>Status</th><th>Coordinates</th></tr></thead>
        <tbody>${(parcels.features || []).map((f) => `
          <tr>
            <td>${f.properties.parcel_code}</td>
            <td>${f.properties.zone_id}</td>
            <td>${f.properties.application_id || "-"}</td>
            <td><span class="status ${f.properties.application_status || ""}">${f.properties.application_status || "registered"}</span></td>
            <td>${JSON.stringify(f.geometry.coordinates[0][0])}</td>
          </tr>`).join("")}</tbody>
      </table>
    </div>
  `;
}

function drawLeafletMap() {
  if (currentPage !== "Map" || !window.L || !document.getElementById("map")) return;
  const map = L.map("map").setView([31.9026, 35.201], 16);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "OpenStreetMap",
  }).addTo(map);

  const layer = L.geoJSON(parcels, {
    style: {
      color: "#0b6b57",
      weight: 2,
      fillColor: "#48a888",
      fillOpacity: 0.28,
    },
    onEachFeature: (feature, polygon) => {
      const props = feature.properties || {};
      polygon.bindPopup(`
        <strong>${props.parcel_code || "Parcel"}</strong><br>
        Zone: ${props.zone_id || "-"}<br>
        Application: ${props.application_id || "-"}<br>
        Status: ${props.application_status || props.registration_status || "-"}<br>
        Dispute: ${props.dispute_state || "none"}
      `);
    },
  }).addTo(map);

  if (layer.getBounds && layer.getBounds().isValid()) {
    map.fitBounds(layer.getBounds(), { padding: [28, 28] });
  }
}

function bars(title, rows) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return `<div class="panel"><h2>${title}</h2><div class="bars">${rows.map((r) => `<div class="bar"><span>${r._id || "none"}</span><span style="--w:${(r.count / max) * 100}%"></span><b>${r.count}</b></div>`).join("")}</div></div>`;
}

function analyticsPage() {
  const byType = Object.values(apps.reduce((acc, app) => {
    acc[app.application_type] = acc[app.application_type] || { _id: app.application_type, count: 0 };
    acc[app.application_type].count += 1;
    return acc;
  }, {}));
  const overTime = Object.values(apps.reduce((acc, app) => {
    const date = (app.timestamps?.submitted_at || "").slice(0, 10) || "today";
    acc[date] = acc[date] || { _id: date, count: 0 };
    acc[date].count += 1;
    return acc;
  }, {}));
  return `
    <div class="grid">
      ${metric("Total Applications", kpis.total_applications || 0)}
      ${metric("Pending", kpis.pending_applications || 0)}
      ${metric("Approved", kpis.approved_applications || 0)}
      ${metric("Rejected", kpis.rejected_applications || 0)}
      ${metric("Objections", kpis.under_objection || 0)}
      ${metric("Survey Due Today", tasks.filter((task) => !task.report_uploaded).length)}
      ${metric("Avg Processing Days", 18.6)}
      ${metric("Certificates", kpis.certificates_issued || 0)}
    </div>
    ${bars("Applications by Status", statuses)}
    ${bars("Applications by Zone", zones)}
    ${bars("Applications by Type", byType)}
    ${bars("Applications Over Time", overTime)}
  `;
}

function loginPage() {
  return `
    <div class="login-shell">
      <section class="login-hero">
        <div class="login-brand">
          <div class="login-logo">LR</div>
          <div class="login-name">LRMIS</div>
        </div>
        <h1>Land Registration Management Information System</h1>
        <p>Secure. Transparent. Efficient.</p>
        <div class="login-landscape">
          <span class="sun"></span>
          <span class="mountain m1"></span>
          <span class="mountain m2"></span>
          <span class="village"></span>
          <span class="road"></span>
        </div>
      </section>
      <section class="login-panel">
        <div class="welcome-block">
          <h1>Welcome to LRMIS</h1>
          <p>Please select how you want to continue</p>
        </div>
        <div class="role-list">
          ${[
            ["Applicant", "Citizen, Lawyer, Company or Representative", "person"],
            ["Staff / Registrar", "Manage applications and reviews", "staff"],
            ["Surveyor", "View assigned tasks and surveys", "survey"],
            ["Manager / Admin", "Analytics and system management", "chart"],
          ].map(([role, description, icon]) => `
            <button class="role-card ${icon}" onclick="setPage('${role === "Manager / Admin" ? "Analytics" : role === "Staff / Registrar" ? "Staff" : role}')">
              <span class="role-icon">${iconSymbol(icon)}</span>
              <span class="role-copy"><b>${role}</b><small>${description}</small></span>
              <span class="role-arrow">→</span>
            </button>
          `).join("")}
        </div>
      </section>
    </div>
  `;
}

function iconSymbol(type) {
  return {
    person: "👤",
    staff: "▣",
    survey: "⌖",
    chart: "▥",
  }[type] || "•";
}

function certificatePreview() {
  const issued = apps.find((app) => app.status === "certificate_issued") || apps[0];
  if (!issued) return `<div class="empty">No application is available for certificate preview.</div>`;
  return `
    <div class="panel">
      <h2>Land Registration Certificate</h2>
      <div class="certificate">
        <div class="certificate-paper">
          <div>
            <h2>Land Registration Certificate</h2>
            <p>This certifies that the parcel record is registered in LRMIS.</p>
            <h3>${issued.application_id}</h3>
            <p>${issued.applicant_ref?.full_name || ""}</p>
            <div class="seal"></div>
          </div>
        </div>
        <div class="panel">
          <h3>Certificate Details</h3>
          <p><b>Applicant:</b> ${issued.applicant_ref?.full_name || ""}</p>
          <p><b>Parcel:</b> ${issued.parcel_ref?.parcel_number || ""}</p>
          <p><b>Zone:</b> ${issued.parcel_ref?.zone_id || ""}</p>
          <p><b>Status:</b> ${issued.status}</p>
          <div class="qr">LRMIS<br>VERIFY</div>
          <p><b>Verification URL:</b> /certificates/CERT-2026-0001/verify</p>
          <div class="toolbar"><button class="btn secondary" onclick="window.print()">Print</button><button class="btn" onclick="window.print()">Download PDF</button></div>
        </div>
      </div>
    </div>
  `;
}

function content() {
  if (currentPage === "Login") return loginPage();
  if (currentPage === "Applicant") return applicantPage();
  if (currentPage === "Confirmation") return confirmationPage();
  if (currentPage === "Track") return trackPage();
  if (currentPage === "Documents") return documentsPage();
  if (currentPage === "Objection") return objectionPage();
  if (currentPage === "Staff") return staffPage();
  if (currentPage === "Details") return detailsPage();
  if (currentPage === "Surveyor") return surveyorPage();
  if (currentPage === "Registrar") return registrarPage() + certificatePreview();
  if (currentPage === "Map") return mapPage();
  return analyticsPage();
}

function render() {
  const pages = ["Login", "Applicant", "Confirmation", "Track", "Documents", "Objection", "Staff", "Details", "Surveyor", "Registrar", "Map", "Analytics"];
  if (currentPage === "Login") {
    root.innerHTML = loginPage();
    return;
  }
  root.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand-wrap"><div class="brand-mark">L</div><div class="brand">LRMIS</div></div>
        <div class="subtitle">Land Registration Management Information System<br>Secure. Transparent. Efficient.</div>
        <div class="side-art"></div>
        <div class="nav">${pages.map((page) => `<button class="${currentPage === page ? "active" : ""}" onclick="setPage('${page}')">${page}</button>`).join("")}</div>
      </aside>
      <main class="main">
        <div class="topbar">
          ${pageIntro(currentPage, currentPage === "Login" ? "Role selection" : "LRMIS workspace")}
          <div class="toolbar"><button class="btn secondary" onclick="loadData()">Refresh</button><button class="btn" onclick="seedData()">Seed Sample Data</button></div>
        </div>
        ${notice ? `<div class="notice">${notice}</div>` : ""}
        ${content()}
      </main>
    </div>
  `;
  setTimeout(drawLeafletMap, 0);
}

render();
loadData();
