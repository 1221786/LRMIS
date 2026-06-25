from fastapi import APIRouter, HTTPException
from app.core.database import db
from datetime import datetime
import uuid

router = APIRouter()

collection = db["land_applications"]
survey_tasks = db["survey_tasks"]
surveyors = db["staff_members"]

# 🧠 Workflow (أساسي جداً)
WORKFLOW = {
    "submitted": "pre_checked",
    "pre_checked": "survey_required",
    "survey_required": "surveyed",
    "surveyed": "legal_review",
    "legal_review": "approved",
    "approved": "certificate_issued",
    "certificate_issued": "closed"
}

# 🟢 1. Create Application
@router.post("/applications")
def create_application(data: dict):

    application_id = str(uuid.uuid4())

    app = {
        "application_id": application_id,

        "type": data.get("type"),

        "applicant": data.get("applicant"),

        "parcel": {
            "parcel_number": data.get("parcel_number"),
            "block": data.get("block"),
            "basin": data.get("basin"),
            "zone": data.get("zone")
        },

        # 🗺️ GIS (مهم للدكتور)
        "location": {
            "type": "Point",
            "coordinates": [
                float(data.get("lng", 0)),
                float(data.get("lat", 0))
            ]
        },

        "status": "submitted",

        "timeline": [
            {
                "status": "submitted",
                "time": datetime.utcnow()
            }
        ],

        "created_at": datetime.utcnow()
    }

    collection.insert_one(app)

    return {
        "message": "Application created",
        "application_id": application_id
    }


# 🟢 2. Get All Applications
@router.get("/applications")
def get_all():

    return list(collection.find({}, {"_id": 0}))


# 🟢 3. Workflow Engine
@router.patch("/applications/{id}/move")
def move(id: str, new_status: str):

    app = collection.find_one({"application_id": id})

    if not app:
        raise HTTPException(404, "Not found")

    current = app["status"]

    if WORKFLOW.get(current) != new_status:
        raise HTTPException(400, "Invalid workflow transition")

    collection.update_one(
        {"application_id": id},
        {
            "$set": {"status": new_status},
            "$push": {
                "timeline": {
                    "status": new_status,
                    "time": datetime.utcnow()
                }
            }
        }
    )

    if new_status == "survey_required":
        existing = survey_tasks.find_one({"application_id": id})
        if not existing:
            surveyor = surveyors.find_one(
                {"role": "surveyor", "$or": [{"status": "available"}, {"active": True}]},
                sort=[("workload.active_tasks", 1), ("workload", 1)],
            )
            if not surveyor:
                raise HTTPException(400, "No available surveyor found")
            task_number = survey_tasks.count_documents({}) + 1
            parcel = app.get("parcel_ref") or app.get("parcel") or {}
            task = {
                "task_id": f"SURV-2026-{task_number:04d}",
                "application_id": id,
                "application_number": id,
                "parcel_id": parcel.get("parcel_id"),
                "parcel_ref": {
                    "parcel_number": parcel.get("parcel_number"),
                    "zone_id": parcel.get("zone_id") or parcel.get("zone"),
                },
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
            collection.update_one(
                {"application_id": id},
                {"$set": {
                    "assignment.assigned_surveyor": str(surveyor["_id"]),
                    "assignment.survey_task_id": str(result.inserted_id),
                }},
            )

    return {"message": "status updated"}
