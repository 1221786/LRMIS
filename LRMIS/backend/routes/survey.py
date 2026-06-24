from bson import ObjectId
from fastapi import APIRouter

from database import db, serialize_doc

router = APIRouter(tags=["Survey"])


@router.get("/survey-tasks")
def list_survey_tasks(assigned_surveyor_id: str | None = None, status: str | None = None):
    query = {}
    if assigned_surveyor_id:
        try:
            query["assigned_surveyor_id"] = ObjectId(assigned_surveyor_id)
        except Exception:
            query["assigned_surveyor_id"] = assigned_surveyor_id
    if status:
        query["status"] = status
    tasks = list(db.survey_tasks.find(query).sort("created_at", -1))
    return serialize_doc(tasks)


@router.get("/survey-reports")
def list_survey_reports():
    return serialize_doc(list(db.survey_reports.find({}).sort("created_at", -1)))

