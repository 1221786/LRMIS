# LRMIS - Land Registration Management Information System

LRMIS is a FastAPI + MongoDB Atlas project for land registration workflows. It covers applicants, land applications, GeoJSON parcels, workflow transitions, surveyor assignment, legal review, objections, certificates, maps, and analytics.

## Technologies

- FastAPI
- MongoDB Atlas
- PyMongo
- Pydantic validation
- React
- Leaflet + OpenStreetMap

## Project Structure

```text
LRMIS/
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── config.py
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── seed/
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   └── src/
├── README.md
├── postman_collection.json
└── .env
```

## Backend Setup

```powershell
cd C:\Users\user\Desktop\webservic\LRMIS\backend
.\run.bat
```

Swagger:

```text
http://127.0.0.1:8004/docs
```

Seed sample data:

```text
POST http://127.0.0.1:8004/seed
```

## Frontend Setup

Open this file in Chrome:

```text
C:\Users\user\Desktop\webservic\LRMIS\frontend\index.html
```

The frontend calls the backend at:

```text
http://127.0.0.1:8004
```

## Environment Variables

```text
MONGO_URI=mongodb+srv://...
DATABASE_NAME=lrmis_db
SECRET_KEY=dev-secret
```

## Main MongoDB Collections

- applicants
- land_applications
- parcels
- application_documents
- objections
- staff_members
- survey_tasks
- survey_reports
- performance_logs
- certificates
- notifications

## Workflow

Main path:

```text
submitted -> pre_checked -> survey_required -> surveyed -> legal_review -> approved -> certificate_issued -> closed
```

Side states:

```text
rejected, on_hold, missing_documents, under_objection
```

All status changes go through `services/workflow_service.py`, which validates allowed transitions and business rules before MongoDB updates.

## Sample Users

- Applicant: `nour@example.com`
- Staff: `staff@example.com`
- Surveyor: `survey_a@example.com`
- Registrar: `registrar@example.com`

## Demo Scenario

1. Open `/docs`.
2. Run `POST /seed`.
3. Open the frontend.
4. Applicant submits an ownership transfer request.
5. Staff moves it through `pre_checked` then `survey_required`.
6. Staff runs auto assignment.
7. Surveyor updates milestones and uploads report.
8. Staff moves the application to `surveyed` then `legal_review`.
9. Registrar approves it.
10. Registrar generates certificate.
11. Open Map and Analytics pages.

## Required Indexes

Indexes are created at startup and by `POST /seed`:

- unique `land_applications.application_id`
- `land_applications.status`
- `land_applications.application_type`
- `land_applications.parcel_ref.zone_id`
- unique `parcels.parcel_code`
- `parcels.geometry` as `2dsphere`
- unique `applicants.identity.national_id`
- unique `staff_members.staff_code`
- survey task and certificate indexes
