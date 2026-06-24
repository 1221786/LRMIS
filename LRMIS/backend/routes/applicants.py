from fastapi import APIRouter, HTTPException
from pymongo.errors import DuplicateKeyError

from database import db, serialize_doc
from models.applicant_model import ApplicantCreate
from services.workflow_service import now

router = APIRouter(prefix="/applicants", tags=["Applicants"])


def applicant_document(payload: ApplicantCreate):
    return {
        "full_name": payload.full_name,
        "applicant_type": payload.applicant_type.value,
        "identity": {
            "national_id": payload.national_id,
            "registration_number": payload.registration_number,
            "verified": True,
            "verification_state": "verified",
            "verification_method": "otp_stub",
            "verified_at": now(),
        },
        "contacts": {"email": payload.email, "phone": payload.phone},
        "address": {"city": payload.city, "neighborhood": payload.neighborhood, "zone_id": payload.zone_id},
        "preferences": {
            "language": payload.language,
            "preferred_contact": payload.preferred_contact,
            "notifications": {
                "on_status_change": True,
                "on_missing_documents": True,
                "on_certificate_ready": True,
            },
        },
        "privacy_settings": {"show_phone_to_staff": True, "show_email_to_staff": True},
        "linked_applications": [],
        "stats": {"total_applications": 0, "approved_applications": 0, "pending_applications": 0},
        "created_at": now(),
        "updated_at": now(),
    }


@router.post("/")
def create_applicant(payload: ApplicantCreate):
    if payload.national_id:
        existing = db.applicants.find_one({"identity.national_id": payload.national_id})
        if existing:
            return serialize_doc(existing)
    try:
        doc = applicant_document(payload)
        result = db.applicants.insert_one(doc)
        doc["_id"] = result.inserted_id
        return serialize_doc(doc)
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail="national_id already exists") from exc


@router.get("/{applicant_id}")
def get_applicant(applicant_id: str):
    applicant = db.applicants.find_one({"_id": applicant_id}) or db.applicants.find_one({"identity.national_id": applicant_id})
    if not applicant:
        from bson import ObjectId

        try:
            applicant = db.applicants.find_one({"_id": ObjectId(applicant_id)})
        except Exception:
            applicant = None
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")
    return serialize_doc(applicant)


@router.get("/{applicant_id}/applications")
def applicant_applications(applicant_id: str):
    from bson import ObjectId

    query_ids = [applicant_id]
    try:
        query_ids.append(ObjectId(applicant_id))
    except Exception:
        pass
    apps = list(db.land_applications.find({"applicant_ref.applicant_id": {"$in": query_ids}}).sort("timestamps.submitted_at", -1))
    return serialize_doc(apps)

