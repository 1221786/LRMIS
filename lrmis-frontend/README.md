# 🏛️ LRMIS - Land Registration Management Information System

## 📌 Project Overview
LRMIS is a full government-level GIS-based land registration system that manages land applications, survey workflows, registrar approvals, certificates, and geospatial mapping.

---

## 🚀 Features

### 🟢 Applicant System
- Submit land applications
- Track application status
- Upload documents
- Submit objections

### 🟡 Staff System
- Manage applications
- Workflow transitions
- Approve / reject applications

### 🟠 Surveyor System
- Receive assigned tasks
- Update survey milestones
- Upload field reports

### 🔵 Registrar System
- Legal review of applications
- Approve / reject applications
- Issue certificates

### 🌍 GIS Module
- Interactive map (Leaflet + OpenStreetMap)
- Display parcels (GeoJSON)
- Show applicants & surveyors
- Heatmap support

---

## ⚙️ Tech Stack

### Backend:
- FastAPI
- MongoDB (PyMongo)
- Pydantic
- Uvicorn

### Frontend:
- React
- Leaflet
- Axios
- CSS (Modern UI)

---

## 🧠 Workflow

submitted  
→ pre_checked  
→ survey_required  
→ surveyed  
→ legal_review  
→ approved  
→ certificate_issued  
→ closed  

---

## 🗂️ Database Collections

- land_applications  
- applicants  
- staff_members  
- survey_tasks  
- survey_reports  
- application_documents  
- objections  
- certificates  
- parcels  
- performance_logs  

---

## 🗺️ GIS Features
- GeoJSON parcels rendering
- Live markers for applicants & surveyors
- Map visualization using Leaflet
- Zone-based filtering

---

## 📊 Analytics
- Applications by status
- Survey workload
- Certificates issued
- System performance logs

---

## ▶️ Run Project

### Backend:
```bash
uvicorn app.main:app --reload