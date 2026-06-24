from fastapi import APIRouter
from app.core.database import db

router = APIRouter()

applicants = db["applicants"]
surveyors = db["surveyors"]

# 🗺 GIS INTELLIGENCE DASHBOARD (A++ CORE)
@router.get("/gis/intelligence")
def gis_intelligence():

    apps = list(applicants.find({}, {"_id": 0}))
    surs = list(surveyors.find({}, {"_id": 0}))

    active_surveyors = len([s for s in surs if s.get("status") == "busy"])

    total_workload = sum([s.get("workload", 0) for s in surs])
    avg_workload = round(total_workload / len(surs), 2) if len(surs) > 0 else 0

    return {
        "metrics": {
            "total_applicants": len(apps),
            "total_surveyors": len(surs),
            "active_surveyors": active_surveyors,
            "available_surveyors": len([s for s in surs if s.get("status") == "available"]),
            "avg_workload": avg_workload
        },
        "data": {
            "applicants": apps,
            "surveyors": surs
        }
    }


# 🗺 HEATMAP DATA (A++ FEATURE)
@router.get("/gis/heatmap")
def heatmap():

    data = list(applicants.find({}, {"_id": 0, "latitude": 1, "longitude": 1}))

    points = []

    for d in data:
        if d.get("latitude") is not None and d.get("longitude") is not None:
            points.append([d["latitude"], d["longitude"], 1])

    return {"heatmap": points}