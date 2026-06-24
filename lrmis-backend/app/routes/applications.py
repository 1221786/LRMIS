from fastapi import APIRouter, HTTPException
from app.core.database import db
from datetime import datetime
import uuid

router = APIRouter()

collection = db["land_applications"]

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

    return {"message": "status updated"}