import re

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator

from app.database import db, serialize_object_id
from app.services.auth import get_current_user, require_roles
from app.services.workflow import WorkflowError, get_application, log_action, now

router = APIRouter(prefix="/applicants", tags=["Applicants"])


class ApplicantCreate(BaseModel):
    full_name: str = Field(..., min_length=2)
    national_id: str | None = None
    registration_number: str | None = None
    contacts: dict
    address: dict
    type: str | None = None
    applicant_type: str | None = None
    verification_state: str = "unverified"
    preferred_language: str = "English"
    notification_preferences: dict = {"email": True, "sms": False}
    privacy_settings: dict = {"share_contact_with_staff": True}
    preferences: dict = {}

    @model_validator(mode="after")
    def normalize_profile(self):
        self.national_id = self.national_id or self.registration_number
        if not self.national_id:
            raise ValueError("national_id or registration_number is required")
        self.applicant_type = self.applicant_type or self.type
        if self.applicant_type not in {"citizen", "lawyer", "company", "surveyor", "authorized_representative"}:
            raise ValueError("applicant_type is invalid")
        if self.verification_state not in {"unverified", "verified", "suspended"}:
            raise ValueError("verification_state is invalid")
        self.type = self.applicant_type
        return self


class CommentCreate(BaseModel):
    comment: str = Field(..., min_length=1)
    actor: dict | None = None


class ApplicantUpdate(BaseModel):
    full_name: str | None = None
    national_id: str | None = None
    registration_number: str | None = None
    contacts: dict | None = None
    address: dict | None = None
    applicant_type: str | None = None
    type: str | None = None
    verification_state: str | None = None
    preferred_language: str | None = None
    notification_preferences: dict | None = None
    privacy_settings: dict | None = None
    preferences: dict | None = None

    @model_validator(mode="after")
    def validate_update(self):
        if self.full_name is not None and len(self.full_name.strip()) < 2:
            raise ValueError("full_name is required")
        if self.contacts:
            email = self.contacts.get("email")
            phone = self.contacts.get("phone")
            if email and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", str(email)):
                raise ValueError("email format is invalid")
            if phone and not re.match(r"^[0-9+\-\s()]{7,20}$", str(phone)):
                raise ValueError("phone format is invalid")
        applicant_type = self.applicant_type or self.type
        if applicant_type and applicant_type not in {"citizen", "lawyer", "company", "surveyor", "authorized_representative"}:
            raise ValueError("applicant_type is invalid")
        if self.verification_state and self.verification_state not in {"unverified", "verified", "suspended"}:
            raise ValueError("verification_state is invalid")
        if self.preferred_language and self.preferred_language not in {"ar", "en", "Arabic", "English"}:
            raise ValueError("preferred_language must be ar or en")
        if self.notification_preferences:
            for key, value in self.notification_preferences.items():
                if not isinstance(value, bool):
                    raise ValueError(f"notification_preferences.{key} must be true or false")
        return self


def applicant_query(applicant_id: str) -> dict:
    try:
        return {"$or": [{"_id": ObjectId(applicant_id)}, {"national_id": applicant_id}]}
    except Exception:
        return {"national_id": applicant_id}


def create_notification(recipient_id: str, subject: str, message: str) -> None:
    db.notifications.insert_one(
        {
            "type": "email",
            "to": recipient_id,
            "message": message,
            "sent": False,
            "stub": True,
            "recipient_type": "applicant",
            "recipient_id": recipient_id,
            "channel": "stub",
            "subject": subject,
            "message": message,
            "status": "created",
            "created_at": now(),
        }
    )


def mask_email(value: str | None) -> str | None:
    if not value or "@" not in value:
        return value
    name, domain = value.split("@", 1)
    return f"{name[:1]}***@{domain}"


def mask_phone(value: str | None) -> str | None:
    if not value:
        return value
    if len(value) <= 6:
        return "***"
    return f"{value[:4]}***{value[-3:]}"


def mask_identifier(value: str | None) -> str | None:
    if not value:
        return value
    return f"{'*' * max(len(value) - 3, 3)}{value[-3:]}"


@router.post("/")
def create_applicant(payload: ApplicantCreate, user: dict = Depends(require_roles("staff", "applicant"))):
    existing = db.applicants.find_one({"national_id": payload.national_id})
    if existing:
        if user["role"] == "applicant":
            db.users.update_one({"_id": user["_id"]}, {"$set": {"linked_id": str(existing["_id"])}})
        return serialize_object_id(existing)

    applicant = payload.model_dump()
    applicant["identity"] = {
        "national_id": applicant["national_id"],
        "registration_number": applicant.get("registration_number"),
    }
    applicant["verification"] = {"state": applicant["verification_state"], "verified_at": None}
    applicant["linked_applications"] = []
    applicant["stats"] = {"applications_count": 0, "pending_count": 0, "approved_count": 0}
    applicant["created_at"] = now()
    applicant["updated_at"] = now()
    result = db.applicants.insert_one(applicant)
    applicant["_id"] = result.inserted_id

    create_notification(str(result.inserted_id), "Applicant profile created", "Your applicant profile is ready.")
    if user["role"] == "applicant":
        db.users.update_one({"_id": user["_id"]}, {"$set": {"linked_id": str(result.inserted_id)}})
    return serialize_object_id(applicant)


@router.get("/{applicant_id}")
def get_applicant(applicant_id: str, user: dict = Depends(get_current_user)):
    if user["role"] == "applicant" and user["linked_id"] != applicant_id:
        raise HTTPException(status_code=403, detail="You can only access your own applicant profile")
    applicant = db.applicants.find_one(applicant_query(applicant_id))
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")
    applicant.pop("internal_notes", None)
    privacy = applicant.get("privacy_settings") or {}
    if user["role"] != "applicant":
        if privacy.get("mask_national_id", True):
            applicant["national_id"] = mask_identifier(applicant.get("national_id"))
            applicant.setdefault("identity", {})["national_id"] = mask_identifier(applicant.get("identity", {}).get("national_id"))
        if privacy.get("hide_phone_from_staff"):
            applicant.setdefault("contacts", {})["phone"] = mask_phone(applicant.get("contacts", {}).get("phone"))
        if privacy.get("mask_email"):
            applicant.setdefault("contacts", {})["email"] = mask_email(applicant.get("contacts", {}).get("email"))
    return serialize_object_id(applicant)


@router.patch("/{applicant_id}")
def update_applicant(applicant_id: str, payload: ApplicantUpdate, user: dict = Depends(require_roles("staff", "applicant"))):
    if user["role"] == "applicant" and user["linked_id"] != applicant_id:
        raise HTTPException(status_code=403, detail="You can only update your own applicant profile")
    applicant = db.applicants.find_one(applicant_query(applicant_id))
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")
    update = {key: value for key, value in payload.model_dump().items() if value is not None}
    if user["role"] == "applicant":
        forbidden = {"national_id", "registration_number", "applicant_type", "type", "verification_state"}
        blocked = sorted(forbidden.intersection(update.keys()))
        if blocked:
            raise HTTPException(status_code=403, detail=f"Restricted fields cannot be edited by applicant: {', '.join(blocked)}")
    if "applicant_type" in update:
        update["type"] = update["applicant_type"]
    if "verification_state" in update:
        update["verification.state"] = update.pop("verification_state")
    if "national_id" in update or "registration_number" in update:
        identity = applicant.get("identity", {})
        if "national_id" in update:
            identity["national_id"] = update["national_id"]
        if "registration_number" in update:
            identity["registration_number"] = update["registration_number"]
        update["identity"] = identity
    if update:
        changed_fields = sorted(update.keys())
        update["updated_at"] = now()
        db.applicants.update_one({"_id": applicant["_id"]}, {"$set": update})
        db.performance_logs.insert_one(
            {
                "event_type": "profile_updated",
                "applicant_id": str(applicant["_id"]),
                "changed_fields": changed_fields,
                "actor": {"role": user["role"], "id": user.get("linked_id")},
                "created_at": now(),
            }
        )
        create_notification(str(applicant["_id"]), "Profile updated", "Your applicant profile was updated successfully.")
    return serialize_object_id(db.applicants.find_one({"_id": applicant["_id"]}))


@router.get("/{applicant_id}/applications")
def get_applicant_applications(applicant_id: str, user: dict = Depends(get_current_user)):
    if user["role"] == "applicant" and user["linked_id"] != applicant_id:
        raise HTTPException(status_code=403, detail="You can only access your own applications")
    applicant = db.applicants.find_one(applicant_query(applicant_id))
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")

    linked_object_ids = []
    linked_string_ids = []
    for value in applicant.get("linked_applications", []):
        linked_string_ids.append(str(value))
        if ObjectId.is_valid(str(value)):
            linked_object_ids.append(ObjectId(str(value)))
    applications = list(
        db.land_applications.find(
            {
                "$or": [
                    {"applicant_ref.applicant_id": str(applicant["_id"])},
                    {"applicant_ref.applicant_id": applicant["_id"]},
                    {"applicant_ref.national_id": applicant.get("national_id")},
                    {"applicant_ref.identity.national_id": applicant.get("national_id")},
                    {"_id": {"$in": linked_object_ids}},
                    {"application_id": {"$in": linked_string_ids}},
                ]
            }
        ).sort("created_at", -1)
    )
    items = [
        {
            "application_id": application.get("application_id"),
            "application_type": application.get("application_type") or application.get("type"),
            "status": application.get("status"),
            "submitted_date": application.get("created_at"),
            "parcel_number": application.get("parcel_ref", {}).get("parcel_number"),
            "next_step": (application.get("workflow") or {}).get("allowed_next", []),
            **application,
        }
        for application in applications
    ]
    return serialize_object_id({"items": items, "count": len(items)})


def add_application_comment(application_id: str, payload: CommentCreate):
    try:
        application = get_application(application_id)
    except WorkflowError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    comment = {
        "comment": payload.comment,
        "actor": payload.actor or {"role": "applicant", "id": application["applicant_ref"]["applicant_id"]},
        "created_at": now(),
    }
    db.land_applications.update_one(
        {"_id": application["_id"]},
        {"$push": {"comments": comment}, "$set": {"updated_at": now()}},
    )
    log_action(application, "comment_added", actor=comment["actor"], metadata={"comment": payload.comment})
    create_notification(
        application["applicant_ref"]["applicant_id"],
        "Comment added",
        f"A comment was added to application {application['application_id']}.",
    )
    return serialize_object_id(comment)
