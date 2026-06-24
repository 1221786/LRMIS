from fastapi import APIRouter
from app.core.database import db

router = APIRouter()

applications = db["land_applications"]
survey_tasks = db["survey_tasks"]
certificates = db["certificates"]
surveyors = db["staff_members"]

# 🟢 KPI DASHBOARD (MAIN REQUIREMENT)
@router.get("/analytics/kpis")
def kpis():

    return {
        "applications": {
            "total": applications.count_documents({}),
            "submitted": applications.count_documents({"status": "submitted"}),
            "pre_checked": applications.count_documents({"status": "pre_checked"}),
            "survey_required": applications.count_documents({"status": "survey_required"}),
            "surveyed": applications.count_documents({"status": "surveyed"}),
            "legal_review": applications.count_documents({"status": "legal_review"}),
            "approved": applications.count_documents({"status": "approved"}),
            "rejected": applications.count_documents({"status": "rejected"}),
            "under_objection": applications.count_documents({"status": "under_objection"}),
            "certificate_issued": applications.count_documents({"status": "certificate_issued"})
        },

        "survey": {
            "total_tasks": survey_tasks.count_documents({}),
            "completed": survey_tasks.count_documents({"status": "report_uploaded"}),
            "in_progress": survey_tasks.count_documents({"status": "survey_started"})
        },

        "certificates": {
            "total": certificates.count_documents({})
        },

        "surveyors": {
            "total": surveyors.count_documents({}),
            "available": surveyors.count_documents({"status": "available"}),
            "busy": surveyors.count_documents({"status": "busy"})
        }
    }


# 🟢 GEO DATA FOR MAP (REQUIRED)
@router.get("/gis/geodata")
def geodata():

    apps = list(applications.find({}, {"_id": 0}))

    parcels = []

    for a in apps:
        if "parcel" in a:
            parcels.append({
                "application_id": a["application_id"],
                "status": a["status"],
                "zone": a.get("zone", "unknown"),
                "type": a.get("type", "unknown"),
                "coordinates": a.get("geometry", None)
            })

    return {
        "parcels": parcels,
        "applications": apps
    }


# 🟢 HEATMAP DATA (HOTSPOTS)
@router.get("/gis/heatmap")
def heatmap():

    apps = list(applications.find({}, {"_id": 0, "latitude": 1, "longitude": 1}))

    points = []

    for a in apps:
        if a.get("latitude") and a.get("longitude"):
            points.append([
                a["latitude"],
                a["longitude"],
                1
            ])

    return {"heatmap": points}


# 🟢 WORKLOAD ANALYTICS
@router.get("/analytics/workload")
def workload():

    staff = list(surveyors.find({}))

    result = []

    for s in staff:
        result.append({
            "name": s.get("name"),
            "workload": s.get("workload", 0),
            "status": s.get("status")
        })

    return {"staff_workload": result}