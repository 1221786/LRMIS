from bson import ObjectId
from fastapi import APIRouter, Depends, Query

from app.database import db, serialize_object_id
from app.services.auth import get_current_user, require_roles

router = APIRouter(tags=["Operations"])


def accessible_application_object_ids(user: dict) -> list[str] | None:
    if user["role"] == "staff":
        return None
    if user["role"] == "applicant":
        applications = db.land_applications.find({"applicant_ref.applicant_id": user["linked_id"]}, {"_id": 1})
        return [str(application["_id"]) for application in applications]
    if user["role"] == "surveyor":
        tasks = db.survey_tasks.find({"assigned_surveyor": user["linked_id"]}, {"application_id": 1})
        return [task["application_id"] for task in tasks]
    return []


@router.get("/logs")
def list_performance_logs(limit: int = Query(default=100, le=500), user: dict = Depends(get_current_user)):
    application_ids = accessible_application_object_ids(user)
    query = {} if application_ids is None else {"application_id": {"$in": application_ids}}
    logs = list(db.performance_logs.find(query).sort("_id", -1).limit(limit))
    return serialize_object_id({"items": logs, "count": len(logs)})


@router.get("/certificates/")
def list_certificates(limit: int = Query(default=100, le=500), user: dict = Depends(get_current_user)):
    application_ids = accessible_application_object_ids(user)
    query = {} if application_ids is None else {"application_id": {"$in": application_ids}}
    certificates = list(db.certificates.find(query).sort("issued_at", -1).limit(limit))
    return serialize_object_id({"items": certificates, "count": len(certificates)})


@router.get("/certificates/{certificate_id}/verify")
def verify_certificate(certificate_id: str):
    certificate = db.certificates.find_one({"certificate_id": certificate_id})
    if not certificate:
        certificate = db.certificates.find_one({"_id": ObjectId(certificate_id)}) if ObjectId.is_valid(certificate_id) else None
    return serialize_object_id({"valid": bool(certificate), "certificate": certificate})


@router.get("/objections")
def list_objections(limit: int = Query(default=100, le=500), user: dict = Depends(get_current_user)):
    application_ids = accessible_application_object_ids(user)
    query = {} if application_ids is None else {"application_id": {"$in": application_ids}}
    objections = list(db.objections.find(query).sort("created_at", -1).limit(limit))
    return serialize_object_id({"items": objections, "count": len(objections)})


@router.get("/notifications")
def list_notifications(limit: int = Query(default=50, le=200), user: dict = Depends(get_current_user)):
    query = {}
    if user["role"] == "applicant":
        query = {"recipient_id": user["linked_id"]}
    notifications = list(db.notifications.find(query).sort("created_at", -1).limit(limit))
    return serialize_object_id({"items": notifications, "count": len(notifications)})


@router.patch("/objections/{objection_id}")
def update_objection(objection_id: str, payload: dict, user: dict = Depends(require_roles("staff"))):
    allowed = {key: value for key, value in payload.items() if key in {"status", "registrar_response", "resolution_note"}}
    if allowed:
        db.objections.update_one({"objection_id": objection_id}, {"$set": allowed})
    objection = db.objections.find_one({"objection_id": objection_id})
    return serialize_object_id(objection)
