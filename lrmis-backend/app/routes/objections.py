from fastapi import APIRouter
from app.core.database import db
from datetime import datetime

router = APIRouter()

objections = db["objections"]
applications = db["land_applications"]

# 🟡 CREATE OBJECTION
@router.post("/applications/{application_id}/objection")
def create_objection(application_id: str, data: dict):

    obj = {
        "application_id": application_id,
        "reason": data.get("reason"),
        "attachments": data.get("attachments", []),
        "status": "pending",
        "created_at": datetime.utcnow()
    }

    objections.insert_one(obj)

    applications.update_one(
        {"application_id": application_id},
        {"$set": {"status": "under_objection"}}
    )

    return {"message": "Objection submitted"}