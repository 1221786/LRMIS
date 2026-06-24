from fastapi import APIRouter
from app.core.database import db

router = APIRouter()

applicants = db["applicants"]
surveyors = db["surveyors"]

# 📊 FULL DASHBOARD ANALYTICS
@router.get("/analytics/kpis")
def kpis():

    return {
        "applicants": {
            "total": applicants.count_documents({}),
            "submitted": applicants.count_documents({"status": "submitted"}),
            "pre_checked": applicants.count_documents({"status": "pre_checked"}),
            "survey_required": applicants.count_documents({"status": "survey_required"}),
            "surveyed": applicants.count_documents({"status": "surveyed"}),
            "legal_review": applicants.count_documents({"status": "legal_review"}),
            "approved": applicants.count_documents({"status": "approved"})
        },
        "surveyors": {
            "total": surveyors.count_documents({}),
            "available": surveyors.count_documents({"status": "available"}),
            "busy": surveyors.count_documents({"status": "busy"})
        }
    }