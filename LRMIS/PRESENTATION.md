# LRMIS Presentation Outline

## 1. Problem
Land registration is not a simple CRUD process. It requires applicant submission, document verification, survey workflow, legal review, objections, certificate issuance, maps, and analytics.

## 2. Solution
LRMIS provides a FastAPI + MongoDB Atlas backend with a React + Leaflet frontend for managing the complete land registration lifecycle.

## 3. Actors
- Applicant: submits and tracks land registration applications.
- Staff: performs pre-check, document review, status updates, hold/reject decisions.
- Surveyor: receives assigned survey tasks, updates milestones, uploads reports.
- Registrar / Manager: performs legal review, issues certificates, monitors dashboards.

## 4. Workflow
Main path:

```text
submitted -> pre_checked -> survey_required -> surveyed -> legal_review -> approved -> certificate_issued -> closed
```

Side states:

```text
missing_documents, under_objection, on_hold, rejected
```

## 5. Backend Highlights
- FastAPI routes grouped by domain.
- MongoDB Atlas with PyMongo.
- Pydantic validation.
- Workflow state machine in `services/workflow_service.py`.
- Audit trail in `performance_logs`.
- Notification stubs.
- Certificate generation with verification URL.
- GeoJSON parcels and `2dsphere` index.

## 6. MongoDB Collections
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

## 7. Demo Scenario
1. Open Swagger.
2. Run `POST /seed`.
3. Open frontend.
4. Submit an ownership transfer request as Applicant.
5. Staff changes status to `pre_checked`.
6. Staff changes status to `survey_required`.
7. Staff runs auto assignment.
8. Surveyor updates task milestones and uploads report.
9. Staff moves the application to `surveyed` then `legal_review`.
10. Registrar approves and generates certificate.
11. Open map and analytics.

## 8. API Quality
Swagger is available at:

```text
http://127.0.0.1:8004/docs
```

Postman collection:

```text
postman_collection.json
```

## 9. Frontend
The React frontend includes:
- Applicant portal
- Staff dashboard
- Surveyor task list
- Registrar actions
- Leaflet map
- Analytics dashboard

