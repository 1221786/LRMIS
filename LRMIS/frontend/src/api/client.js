import axios from "axios";

export const API_BASE_URL = "http://127.0.0.1:8005";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.clear();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export async function api(path, options = {}) {
  const response = await apiClient.request({ url: path, ...options });
  return response.data;
}

export const login = (username, password) => api("/auth/login", { method: "POST", data: { username, password } });
export const logout = () => api("/auth/logout", { method: "POST" });
export const me = () => api("/auth/me");
export const getApplications = (params = {}) => api("/applications/", { params });
export const getApplication = (id) => api(`/applications/${id}`);
export const getTimeline = (id) => api(`/applications/${id}/timeline`);
export const getApplicationDocuments = (id) => api(`/applications/${id}/documents`);
export const getApplicationComments = (id) => api(`/applications/${id}/comments`);
export const getApplicationObjections = (id) => api(`/applications/${id}/objections`);
export const getApplicantApplications = (id) => api(`/applicants/${id}/applications`);
export const getApplicant = (id) => api(`/applicants/${id}`);
export const createApplicant = (body) => api("/applicants/", { method: "POST", data: body });
export const updateApplicant = (id, body) => api(`/applicants/${id}`, { method: "PATCH", data: body });
export const getStaff = (id) => api(`/staff/${id}`);
export const getStaffMembers = (role = "") => api("/staff/", { params: role ? { role } : {} });
export const createStaffMember = (body) => api("/staff/", { method: "POST", data: body });
export const updateStaffMember = (id, body) => api(`/staff/${id}`, { method: "PATCH", data: body });
export const deleteStaffMember = (id) => api(`/staff/${id}`, { method: "DELETE" });
export const getKpis = () => api("/analytics/kpis");
export const getByStatus = () => api("/analytics/applications-by-status");
export const getByZone = () => api("/analytics/applications-by-zone");
export const getParcels = () => api("/analytics/geofeeds/parcels");
export const getProcessingTime = () => api("/analytics/processing-time");
export const getSurveyors = () => api("/analytics/surveyors");
export const getRegistrars = () => api("/analytics/registrars");
export const getPendingHeatmap = () => api("/analytics/geofeeds/pending-heatmap");
export const getAnalyticsDashboard = (params = {}) => api("/analytics/dashboard", { params });
export const getSurveyTasks = () => api("/survey-tasks");
export const autoAssignSurveyor = (applicationId) => api(`/applications/${applicationId}/auto-assign-surveyor`, { method: "POST" });
export const reassignSurveyTask = (taskId, body) => api(`/survey-tasks/${taskId}/reassign`, { method: "PATCH", data: body });
export const getSurveyReports = () => api("/survey-reports");
export const reviewSurveyReport = (applicationId, body) => api(`/applications/${applicationId}/survey-registrar-review`, { method: "PATCH", data: body });
export const getLogs = () => api("/logs");
export const getCertificates = () => api("/certificates/");
export const getObjections = () => api("/objections");
export const getNotifications = () => api("/notifications");
export const updateApplication = (id, body) => api(`/applications/${id}`, { method: "PATCH", data: body });
export const archiveApplication = (id) => api(`/applications/${id}`, { method: "DELETE" });

export function postJson(path, body, headers = {}) {
  return api(path, { method: "POST", data: body, headers });
}

export function patchJson(path, body) {
  return api(path, { method: "PATCH", data: body });
}
