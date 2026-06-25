from datetime import datetime
import uuid

from bson import ObjectId
from fastapi import APIRouter, Header, HTTPException

from app.core.database import db

router = APIRouter()

survey_tasks = db["survey_tasks"]
applications = db["land_applications"]
surveyors = db["staff_members"]
survey_reports = db["survey_reports"]
logs = db["performance_logs"]

SURVEY_FLOW = {
    "assigned": "visit_scheduled",
    "visit_scheduled": "arrived_on_site",
    "arrived_on_site": "survey_started",
    "survey_started": "survey_completed",
}


def serialize(value):
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, list):
        return [serialize(item) for item in value]
    if isinstance(value, dict):
        return {key: serialize(item) for key, item in value.items()}
    return value


@router.post("/applications/{application_id}/auto-assign-surveyor")
def auto_assign(application_id: str):
    app = applications.find_one({"application_id": application_id})
    if not app:
        raise HTTPException(404, "Application not found")
    existing = survey_tasks.find_one({"application_id": application_id})
    if existing:
        return serialize(existing)
    surveyor = surveyors.find_one(
        {"role": "surveyor", "$or": [{"status": "available"}, {"active": True}]},
        sort=[("workload.active_tasks", 1), ("workload", 1)],
    )
    if not surveyor:
        raise HTTPException(404, "No surveyor available")
    parcel = app.get("parcel_ref") or app.get("parcel") or {}
    task = {
        "task_id": f"SURV-2026-{survey_tasks.count_documents({}) + 1:04d}",
        "application_id": application_id,
        "application_number": application_id,
        "parcel_id": parcel.get("parcel_id"),
        "parcel_ref": {"parcel_number": parcel.get("parcel_number"), "zone_id": parcel.get("zone_id") or parcel.get("zone")},
        "parcel_number": parcel.get("parcel_number"),
        "zone_id": parcel.get("zone_id") or parcel.get("zone"),
        "assigned_surveyor": str(surveyor["_id"]),
        "assigned_surveyor_id": str(surveyor["_id"]),
        "surveyor_id": surveyor.get("staff_code"),
        "status": "assigned",
        "current_milestone": "assigned",
        "milestone": "assigned",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    result = survey_tasks.insert_one(task)
    task["_id"] = result.inserted_id
    applications.update_one({"application_id": application_id}, {"$set": {"status": "survey_required", "assignment.assigned_surveyor": str(surveyor["_id"])}})
    return serialize(task)


@router.get("/survey-tasks")
def get_survey_tasks(x_linked_id: str | None = Header(default=None)):
    query = {"assigned_surveyor": x_linked_id} if x_linked_id else {}
    return {"items": serialize(list(survey_tasks.find(query).sort("created_at", -1)))}


@router.patch("/applications/{application_id}/survey-milestone")
def update_milestone(application_id: str, payload: dict):
    task = survey_tasks.find_one({"application_id": application_id})
    if not task:
        raise HTTPException(404, "Task not found")
    current = task.get("current_milestone") or task.get("milestone") or task.get("status")
    new_status = payload.get("milestone") or payload.get("new_status")
    if SURVEY_FLOW.get(current) != new_status:
        raise HTTPException(400, f"Invalid transition. Must go from {current} to {SURVEY_FLOW.get(current)}")
    survey_tasks.update_one(
        {"_id": task["_id"]},
        {"$set": {"milestone": new_status, "current_milestone": new_status, "status": new_status, "updated_at": datetime.utcnow()},
         "$push": {"timeline": {"status": new_status, "time": datetime.utcnow()}}},
    )
    return serialize(survey_tasks.find_one({"_id": task["_id"]}))


@router.post("/applications/{application_id}/survey-report")
def upload_report(application_id: str, report: dict):
    task = survey_tasks.find_one({"application_id": application_id})
    if not task:
        raise HTTPException(404, "Survey task not found")
    if (task.get("current_milestone") or task.get("status")) != "survey_completed":
        raise HTTPException(400, "Cannot upload report before survey_completed")
    metadata = {
        "report_id": f"SR-2026-{survey_reports.count_documents({}) + 1:04d}",
        "application_id": application_id,
        "application_number": application_id,
        "survey_task_id": str(task["_id"]),
        "assigned_surveyor": task.get("assigned_surveyor"),
        "report_type": report.get("report_type"),
        "file_name": report.get("file_name"),
        "file_url": report.get("file_url"),
        "summary": report.get("summary"),
        "findings": report.get("findings", {}),
        "attachments": report.get("attachments", []),
        "status": "uploaded",
        "registrar_review_status": "pending",
        "uploaded_at": datetime.utcnow(),
    }
    survey_reports.insert_one(metadata)
    survey_tasks.update_one(
        {"_id": task["_id"]},
        {"$set": {"milestone": "report_uploaded", "current_milestone": "report_uploaded", "status": "report_uploaded", "report_uploaded": True, "updated_at": datetime.utcnow()}},
    )
    applications.update_one(
        {"application_id": application_id},
        {"$set": {"status": "surveyed", "survey_report_exists": True, "updated_at": datetime.utcnow()}},
    )
    logs.insert_one({"event": "survey_report_uploaded", "application_id": application_id, "time": datetime.utcnow()})
    return serialize(metadata)
