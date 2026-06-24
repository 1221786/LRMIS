from fastapi import APIRouter, HTTPException
from app.core.database import db
from datetime import datetime
import uuid

router = APIRouter()

survey_tasks = db["survey_tasks"]
applications = db["land_applications"]
surveyors = db["staff_members"]
logs = db["performance_logs"]

# 🟢 SURVEY LIFECYCLE (as required by doctor)
SURVEY_FLOW = {
    "assigned": "visit_scheduled",
    "visit_scheduled": "arrived_on_site",
    "arrived_on_site": "survey_started",
    "survey_started": "survey_completed",
    "survey_completed": "report_uploaded",
    "report_uploaded": "registrar_reviewed"
}

# 🟢 CREATE SURVEY TASK (AUTO ASSIGN)
@router.post("/applications/{application_id}/auto-assign-surveyor")
def auto_assign(application_id: str):

    app = applications.find_one({"application_id": application_id})

    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    # find available surveyor
    surveyor = surveyors.find_one({"role": "surveyor", "status": "available"})

    if not surveyor:
        raise HTTPException(status_code=404, detail="No surveyor available")

    task_id = str(uuid.uuid4())

    task = {
        "task_id": task_id,
        "application_id": application_id,
        "surveyor_id": surveyor.get("staff_code"),
        "status": "assigned",
        "created_at": datetime.utcnow(),
        "milestone": "assigned"
    }

    survey_tasks.insert_one(task)

    # update application
    applications.update_one(
        {"application_id": application_id},
        {"$set": {"status": "survey_required", "assigned_surveyor": surveyor.get("name")}}
    )

    # log
    logs.insert_one({
        "event": "survey_assigned",
        "application_id": application_id,
        "surveyor": surveyor.get("name"),
        "time": datetime.utcnow()
    })

    return {
        "message": "Surveyor assigned successfully",
        "task_id": task_id
    }


# 🟢 UPDATE SURVEY MILESTONE
@router.patch("/applications/{application_id}/survey-milestone")
def update_milestone(application_id: str, new_status: str):

    task = survey_tasks.find_one({"application_id": application_id})

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    current = task["milestone"]

    if current not in SURVEY_FLOW:
        raise HTTPException(status_code=400, detail="Invalid workflow step")

    expected = SURVEY_FLOW[current]

    if new_status != expected:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid transition. Must go to {expected}"
        )

    survey_tasks.update_one(
        {"application_id": application_id},
        {
            "$set": {"milestone": new_status, "status": new_status},
            "$push": {
                "timeline": {
                    "status": new_status,
                    "time": datetime.utcnow()
                }
            }
        }
    )

    return {
        "message": "Survey milestone updated",
        "status": new_status
    }


# 🟢 SUBMIT SURVEY REPORT
@router.post("/applications/{application_id}/survey-report")
def upload_report(application_id: str, report: dict):

    survey_tasks.update_one(
        {"application_id": application_id},
        {
            "$set": {
                "report": report,
                "milestone": "report_uploaded",
                "status": "report_uploaded"
            }
        }
    )

    applications.update_one(
        {"application_id": application_id},
        {"$set": {"status": "legal_review"}}
    )

    logs.insert_one({
        "event": "survey_completed",
        "application_id": application_id,
        "time": datetime.utcnow()
    })

    return {"message": "Report uploaded successfully"}


# 🟢 GET TASKS (FOR SURVEYOR DASHBOARD)
@router.get("/staff/{staff_id}")
def get_tasks(staff_id: str):

    tasks = list(survey_tasks.find({"surveyor_id": staff_id}, {"_id": 0}))

    return {
        "count": len(tasks),
        "tasks": tasks
    }