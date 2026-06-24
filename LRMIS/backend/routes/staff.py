from bson import ObjectId
from fastapi import APIRouter, HTTPException
from pymongo.errors import DuplicateKeyError

from database import db, serialize_doc
from models.staff_model import StaffCreate
from services.workflow_service import now

router = APIRouter(prefix="/staff", tags=["Staff"])


@router.post("/")
def create_staff(payload: StaffCreate):
    doc = {
        "staff_code": payload.staff_code,
        "name": payload.name,
        "role": payload.role,
        "department": payload.department,
        "skills": payload.skills,
        "coverage": {"zone_ids": payload.zone_ids},
        "schedule": {"timezone": "Asia/Jerusalem", "shifts": [{"day": "Mon", "start": "08:00", "end": "16:00"}], "on_call": False},
        "workload": {"active_tasks": 0, "max_tasks": payload.max_tasks},
        "contacts": {"phone": payload.phone, "email": payload.email},
        "active": True,
        "created_at": now(),
    }
    try:
        result = db.staff_members.insert_one(doc)
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail="staff_code already exists") from exc
    doc["_id"] = result.inserted_id
    return serialize_doc(doc)


@router.get("/")
def list_staff(role: str | None = None):
    query = {"role": role} if role else {}
    return serialize_doc(list(db.staff_members.find(query).sort("name", 1)))


@router.get("/{staff_id}")
def get_staff(staff_id: str):
    query = {"staff_code": staff_id}
    try:
        query = {"$or": [{"staff_code": staff_id}, {"_id": ObjectId(staff_id)}]}
    except Exception:
        pass
    staff = db.staff_members.find_one(query)
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    tasks = list(db.survey_tasks.find({"assigned_surveyor_id": staff["_id"]}))
    staff["tasks"] = tasks
    return serialize_doc(staff)

