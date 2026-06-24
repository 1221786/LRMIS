from fastapi import APIRouter
from app.core.database import db

router = APIRouter()

staff = db["staff_members"]
applications = db["land_applications"]

# 🟢 GET STAFF DASHBOARD STATS
@router.get("/staff/dashboard")
def staff_dashboard():

    return {
        "total_applications": applications.count_documents({}),
        "pending_review": applications.count_documents({"status": "pre_checked"}),
        "under_survey": applications.count_documents({"status": "survey_required"}),
        "legal_review": applications.count_documents({"status": "legal_review"}),
        "approved": applications.count_documents({"status": "approved"})
    }