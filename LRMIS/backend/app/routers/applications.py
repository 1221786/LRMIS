from datetime import datetime, timezone
from uuid import uuid4

from bson import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field, model_validator

from app.database import db, serialize_object_id
from app.services.auth import ensure_application_access, get_current_user, require_roles
from app.services.workflow import (
    ALLOWED_TRANSITIONS,
    WorkflowError,
    get_application,
    is_valid_geojson_polygon,
    log_action,
    now,
    object_id,
    transition_application,
)

router = APIRouter(prefix="/applications", tags=["Applications"])

APPLICATION_TYPES = {
    "first_registration",
    "ownership_transfer",
    "parcel_subdivision",
    "parcel_merge",
    "boundary_correction",
    "certificate_request",
}

DOCUMENT_REQUIREMENTS = {
    "first_registration": ["id_copy", "proof_of_ownership", "parcel_map"],
    "ownership_transfer": ["id_copy", "ownership_deed", "sale_contract"],
    "parcel_subdivision": ["id_copy", "ownership_deed", "subdivision_plan", "survey_report"],
    "parcel_merge": ["id_copy", "ownership_deed", "merge_plan", "survey_report"],
    "boundary_correction": ["id_copy", "ownership_deed", "boundary_correction_request", "survey_report"],
    "certificate_request": ["id_copy", "parcel_reference", "proof_of_ownership"],
}


class ApplicantInput(BaseModel):
    full_name: str = Field(..., min_length=2)
    national_id: str = Field(..., min_length=5)
    contacts: dict
    address: dict
    type: str


class ParcelInput(BaseModel):
    parcel_code: str | None = None
    parcel_number: str = Field(..., min_length=1)
    block_number: str = Field(..., min_length=1)
    basin_number: str = Field(..., min_length=1)
    zone_id: str = Field(..., min_length=1)
    current_owner_refs: list[str] = []
    area_sqm: float | None = None
    land_use: str = "residential"
    registration_status: str = "pending_registration"
    geometry: dict
    dispute_state: str = "none"


class DocumentInput(BaseModel):
    document_type: str
    file_name: str | None = None
    file_url: str | None = None
    status: str = "pending_review"


class ApplicationUpdate(BaseModel):
    priority: str | None = None
    description: str | None = None
    tags: list[str] | None = None
    internal_reference: str | None = None


class ApplicationCreate(BaseModel):
    type: str | None = None
    application_type: str | None = None
    priority: str = "normal"
    description: str = ""
    applicant: ApplicantInput
    parcel: ParcelInput
    documents: list[DocumentInput] = []

    @model_validator(mode="after")
    def normalize_type(self):
        selected_type = self.type or self.application_type
        if selected_type not in APPLICATION_TYPES:
            raise ValueError("application_type must be one of the supported LRMIS application types")
        self.type = selected_type
        self.application_type = selected_type
        return self


class TransitionInput(BaseModel):
    new_status: str | None = None
    target_state: str | None = None
    actor: dict | None = None
    note: str | None = None

    @model_validator(mode="after")
    def normalize_target(self):
        self.new_status = self.new_status or self.target_state
        if not self.new_status:
            raise ValueError("target_state is required")
        return self


class ReasonInput(BaseModel):
    reason: str | None = None
    hold_reason: str | None = None
    rejection_reason: str | None = None
    legal_or_administrative_reason: str | None = None
    held_by: str | None = None
    rejected_by: str | None = None
    note: str | None = None
    actor: dict | None = None

    @model_validator(mode="after")
    def normalize_reason(self):
        self.reason = self.reason or self.hold_reason or self.rejection_reason or self.legal_or_administrative_reason
        if not self.reason or len(self.reason) < 3:
            raise ValueError("reason is required")
        return self


class CertificateInput(BaseModel):
    issued_by: str = "registrar"


class RegistrarReviewInput(BaseModel):
    decision: str = Field(..., min_length=3)
    notes: str | None = None
    visible_to_applicant: bool = True
    actor: dict | None = None


class InternalNoteInput(BaseModel):
    note: str = Field(..., min_length=2)
    visible_to_applicant: bool = False


class MissingDocumentsInput(BaseModel):
    document_types: list[str] = Field(..., min_length=1)
    note: str | None = None


class DocumentReviewInput(BaseModel):
    document_type: str
    decision: str
    rejection_reason: str | None = None


class DocumentUploadInput(BaseModel):
    document_type: str
    file_name: str
    file_url: str
    status: str = "pending_review"
    uploaded_by: dict | None = None

    @model_validator(mode="after")
    def validate_document(self):
        if self.status not in {"uploaded", "pending_review", "verified", "rejected", "missing"}:
            raise ValueError("document status is invalid")
        return self


class ObjectionInput(BaseModel):
    reason: str = Field(..., min_length=5)
    submitted_by: dict
    supporting_documents: list[dict] = []


def next_application_id() -> str:
    return f"LRMIS-2026-{db.land_applications.count_documents({}) + 1:04d}"


def next_certificate_id() -> str:
    return f"CERT-2026-{db.certificates.count_documents({}) + 1:04d}"


def required_documents_for(application_type: str, uploaded_documents: list[DocumentInput]) -> list[dict]:
    uploaded_by_type = {document.document_type: document.model_dump() for document in uploaded_documents}
    required = []
    for document_type in DOCUMENT_REQUIREMENTS.get(application_type, []):
        provided = uploaded_by_type.get(document_type, {})
        required.append(
            {
                "document_type": document_type,
                "required": True,
                "status": provided.get("status") or ("pending_review" if provided else "missing"),
                "file_name": provided.get("file_name"),
                "file_url": provided.get("file_url"),
            }
        )
    for document in uploaded_documents:
        if document.document_type not in DOCUMENT_REQUIREMENTS.get(application_type, []):
            data = document.model_dump()
            data["required"] = False
            required.append(data)
    return required


def create_or_get_applicant(payload: ApplicantInput) -> dict:
    existing = db.applicants.find_one({"national_id": payload.national_id})
    if existing:
        return existing
    doc = payload.model_dump()
    doc["created_at"] = now()
    result = db.applicants.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


def create_or_get_parcel(payload: ParcelInput) -> dict:
    if not is_valid_geojson_polygon(payload.geometry):
        raise HTTPException(status_code=422, detail="Parcel geometry must be valid GeoJSON Polygon")
    existing = db.parcels.find_one(
        {
            "parcel_number": payload.parcel_number,
            "block_number": payload.block_number,
            "basin_number": payload.basin_number,
            "zone_id": payload.zone_id,
        }
    )
    if existing:
        return existing
    doc = payload.model_dump()
    doc["parcel_code"] = doc.get("parcel_code") or f"{payload.zone_id}-B{payload.block_number}-BA{payload.basin_number}-P{payload.parcel_number}"
    doc["created_at"] = now()
    result = db.parcels.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


def serialize_application(application: dict) -> dict:
    return serialize_object_id(application)


def create_notification(application: dict, message: str, notification_type: str = "email") -> None:
    applicant_id = application.get("applicant_ref", {}).get("applicant_id")
    db.notifications.insert_one(
        {
            "type": notification_type,
            "to": applicant_id,
            "message": message,
            "sent": False,
            "stub": True,
            "recipient_type": "applicant",
            "recipient_id": applicant_id,
            "application_id": application.get("application_id"),
            "created_at": now(),
        }
    )


@router.post("/")
def create_application(
    payload: ApplicationCreate,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    user: dict = Depends(require_roles("applicant", "staff")),
):
    if idempotency_key:
        existing = db.land_applications.find_one({"idempotency_key": idempotency_key})
        if existing:
            return serialize_application(existing)

    applicant = create_or_get_applicant(payload.applicant)
    parcel = create_or_get_parcel(payload.parcel)
    duplicate = db.land_applications.find_one(
        {
            "applicant_ref.applicant_id": str(applicant["_id"]),
            "parcel_ref.parcel_number": parcel["parcel_number"],
            "type": payload.type,
            "status": {"$nin": ["rejected", "closed"]},
        }
    )
    if duplicate:
        log_action(duplicate, "duplicate_submission_prevented", actor={"role": user["role"], "id": user["linked_id"]})
        return serialize_application(duplicate)

    application = {
        "application_id": next_application_id(),
        "application_type": payload.type,
        "type": payload.type,
        "status": "submitted",
        "priority": payload.priority,
        "description": payload.description,
        "workflow": {
            "current_state": "submitted",
            "allowed_next": ALLOWED_TRANSITIONS["submitted"],
        },
        "parcel_ref": {
            "parcel_id": str(parcel["_id"]),
            "parcel_code": parcel.get("parcel_code"),
            "parcel_number": parcel["parcel_number"],
            "block_number": parcel["block_number"],
            "basin_number": parcel["basin_number"],
            "zone_id": parcel["zone_id"],
        },
        "applicant_ref": {
            "applicant_id": str(applicant["_id"]),
            "full_name": applicant["full_name"],
        },
        "required_documents": required_documents_for(payload.type, payload.documents),
        "documents": [doc.model_dump() for doc in payload.documents],
        "timestamps": {"submitted_at": now(), "updated_at": now()},
        "assignment": {"assigned_surveyor": None, "assigned_registrar": None},
        "objection": {"has_objection": False, "objection_ids": []},
        "internal": {"notes": [], "visible_registrar_notes": []},
        "idempotency_key": idempotency_key,
        "survey_report_exists": False,
        "legal_review_done": False,
        "created_at": now(),
        "updated_at": now(),
    }
    result = db.land_applications.insert_one(application)
    application["_id"] = result.inserted_id
    db.applicants.update_one(
        {"_id": applicant["_id"]},
        {
            "$addToSet": {"linked_applications": str(result.inserted_id)},
            "$set": {"updated_at": now()},
        },
    )
    log_action(application, "application_submitted", actor={"role": "applicant", "id": str(applicant["_id"])})
    return serialize_application(application)


class CommentInput(BaseModel):
    comment: str = Field(..., min_length=1)
    actor: dict | None = None


class NoteInput(BaseModel):
    note: str = Field(..., min_length=1)
    visible_to_applicant: bool = True
    actor: dict | None = None


@router.get("/")
def list_applications(
    status: str | None = None,
    type: str | None = Query(default=None),
    application_type: str | None = Query(default=None),
    zone_id: str | None = None,
    zone: str | None = None,
    parcel_number: str | None = None,
    applicant_id: str | None = None,
    priority: str | None = None,
    submitted_from: datetime | None = None,
    submitted_to: datetime | None = None,
    sort_by: str = "created_at",
    sort_dir: str = "desc",
    page: int = 1,
    limit: int = 20,
    user: dict = Depends(get_current_user),
):
    query = {}
    if user["role"] == "applicant":
        query["applicant_ref.applicant_id"] = user["linked_id"]
    elif user["role"] == "surveyor":
        tasks = list(db.survey_tasks.find({"assigned_surveyor": user["linked_id"]}))
        application_object_ids = [ObjectId(task["application_id"]) for task in tasks]
        query["_id"] = {"$in": application_object_ids}
    if status:
        query["status"] = status
    selected_type = type or application_type
    if selected_type:
        query["type"] = selected_type
    if parcel_number:
        query["parcel_ref.parcel_number"] = parcel_number
    if applicant_id:
        query["applicant_ref.applicant_id"] = applicant_id
    if priority:
        query["priority"] = priority
    if zone_id:
        query["parcel_ref.zone_id"] = zone_id
    if zone:
        query["parcel_ref.zone_id"] = zone
    if submitted_from or submitted_to:
        query["created_at"] = {}
        if submitted_from:
            query["created_at"]["$gte"] = submitted_from
        if submitted_to:
            query["created_at"]["$lte"] = submitted_to
    sort_direction = -1 if sort_dir.lower() == "desc" else 1
    skip = max(page - 1, 0) * limit
    total = db.land_applications.count_documents(query)
    applications = list(db.land_applications.find(query).sort(sort_by, sort_direction).skip(skip).limit(limit))
    return serialize_object_id({"items": applications, "count": len(applications), "total": total, "page": page, "limit": limit})


@router.get("/{application_id}")
def get_application_by_id(application_id: str, user: dict = Depends(get_current_user)):
    try:
        application = get_application(application_id)
    except WorkflowError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    ensure_application_access(application, user)
    parcel = db.parcels.find_one({"_id": object_id(application.get("parcel_ref", {}).get("parcel_id"))})
    objections = list(db.objections.find({"application_id": str(application["_id"])}))
    certificate = db.certificates.find_one({"application_id": str(application["_id"])})
    survey_task = db.survey_tasks.find_one({"application_id": str(application["_id"])})
    survey_report = db.survey_reports.find_one({"application_id": str(application["_id"])})
    timeline = db.performance_logs.find_one({"application_id": str(application["_id"])})
    return serialize_object_id(
        {
            **application,
            "parcel": parcel,
            "attachments": application.get("documents", []),
            "objections": objections,
            "certificate_status": certificate.get("status") if certificate else "not_issued",
            "certificate": certificate,
            "survey_status": survey_task.get("status") if survey_task else "not_assigned",
            "survey_task": survey_task,
            "survey_report": survey_report,
            "timeline": timeline,
            "visible_registrar_notes": application.get("internal", {}).get("visible_registrar_notes", []),
        }
    )


@router.patch("/{application_id}")
def update_application(application_id: str, payload: ApplicationUpdate, user: dict = Depends(get_current_user)):
    try:
        application = get_application(application_id)
    except WorkflowError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    ensure_application_access(application, user)
    update = {key: value for key, value in payload.model_dump().items() if value is not None}
    update["updated_at"] = now()
    db.land_applications.update_one({"_id": application["_id"]}, {"$set": update})
    updated = get_application(application_id)
    log_action(updated, "application_updated", actor={"role": user["role"], "id": user["linked_id"]}, metadata=update)
    return serialize_object_id(updated)


@router.delete("/{application_id}")
def archive_application(application_id: str, user: dict = Depends(require_roles("staff"))):
    try:
        application = get_application(application_id)
    except WorkflowError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    db.land_applications.update_one(
        {"_id": application["_id"]},
        {"$set": {"archived": True, "archived_at": now(), "updated_at": now()}},
    )
    updated = get_application(application_id)
    log_action(updated, "application_archived", actor={"role": "staff", "id": user["linked_id"]})
    return serialize_object_id(updated)


@router.patch("/{application_id}/transition")
def transition(application_id: str, payload: TransitionInput, user: dict = Depends(require_roles("staff"))):
    try:
        updated = transition_application(
            application_id,
            payload.new_status,
            actor=payload.actor,
            metadata={"note": payload.note} if payload.note else {},
        )
    except WorkflowError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    create_notification(get_application(application_id), f"Your application status changed to {payload.new_status}")
    return updated


@router.post("/{application_id}/internal-notes")
def add_internal_note(application_id: str, payload: InternalNoteInput, user: dict = Depends(require_roles("staff"))):
    try:
        application = get_application(application_id)
    except WorkflowError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    note = {
        "note": payload.note,
        "staff_only": not payload.visible_to_applicant,
        "visible_to_applicant": payload.visible_to_applicant,
        "created_by": user["linked_id"],
        "created_at": now(),
    }
    push = {"internal.notes": note}
    if payload.visible_to_applicant:
        push["internal.visible_registrar_notes"] = note
    db.land_applications.update_one({"_id": application["_id"]}, {"$push": push, "$set": {"updated_at": now()}})
    log_action(application, "internal_note_added", actor={"role": "staff", "id": user["linked_id"]}, metadata=note)
    return serialize_object_id(note)


@router.post("/{application_id}/request-missing-documents")
def request_missing_documents(application_id: str, payload: MissingDocumentsInput, user: dict = Depends(require_roles("staff"))):
    try:
        application = get_application(application_id)
    except WorkflowError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    db.land_applications.update_one(
        {"_id": application["_id"]},
        {
            "$set": {
                "status": "missing_documents",
                "workflow.current_state": "missing_documents",
                "workflow.allowed_next": ALLOWED_TRANSITIONS["missing_documents"],
                "updated_at": now(),
            }
        },
    )
    for document_type in payload.document_types:
        db.land_applications.update_one(
            {"_id": application["_id"], "required_documents.document_type": document_type},
            {"$set": {"required_documents.$.status": "missing"}},
        )
    create_notification(application, f"Missing documents requested: {', '.join(payload.document_types)}")
    log_action(application, "missing_documents_requested", actor={"role": "staff", "id": user["linked_id"]}, metadata=payload.model_dump())
    return serialize_object_id(get_application(application_id))


@router.patch("/{application_id}/documents/review")
def review_document(application_id: str, payload: DocumentReviewInput, user: dict = Depends(require_roles("staff"))):
    if payload.decision not in {"verified", "rejected"}:
        raise HTTPException(status_code=422, detail="decision must be verified or rejected")
    try:
        application = get_application(application_id)
    except WorkflowError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    update_fields = {
        "required_documents.$.status": payload.decision,
        "required_documents.$.reviewed_by": user["linked_id"],
        "required_documents.$.reviewed_at": now(),
    }
    if payload.decision == "rejected":
        update_fields["required_documents.$.rejection_reason"] = payload.rejection_reason
    db.land_applications.update_one(
        {"_id": application["_id"], "required_documents.document_type": payload.document_type},
        {"$set": update_fields},
    )
    db.application_documents.update_many(
        {"application_id": str(application["_id"]), "document_type": payload.document_type},
        {
            "$set": {
                "status": payload.decision,
                "reviewed_by": user["linked_id"],
                "reviewed_at": now(),
                "rejection_reason": payload.rejection_reason,
            }
        },
    )
    create_notification(application, f"Document {payload.document_type} was {payload.decision}")
    log_action(application, f"document_{payload.decision}", actor={"role": "staff", "id": user["linked_id"]}, metadata=payload.model_dump())
    return serialize_object_id(get_application(application_id))


@router.post("/{application_id}/reject")
def reject_application(application_id: str, payload: ReasonInput, user: dict = Depends(require_roles("staff"))):
    try:
        result = transition_application(
            application_id,
            "rejected",
            actor=payload.actor,
            metadata={"rejection_reason": payload.reason, "rejected_by": payload.rejected_by, "note": payload.note},
        )
        db.land_applications.update_one(
            {"application_id": application_id},
            {"$set": {"rejection_reason": payload.reason, "rejected_by": payload.rejected_by, "rejected_at": now()}},
        )
        return result
    except WorkflowError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{application_id}/hold")
def hold_application(application_id: str, payload: ReasonInput, user: dict = Depends(require_roles("staff"))):
    try:
        return transition_application(
            application_id,
            "on_hold",
            actor=payload.actor,
            metadata={"hold_reason": payload.reason, "held_by": payload.held_by, "note": payload.note},
        )
    except WorkflowError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{application_id}/certificate")
def issue_certificate(application_id: str, payload: CertificateInput, user: dict = Depends(require_roles("staff"))):
    try:
        application = get_application(application_id)
        updated_application = transition_application(
            application_id,
            "certificate_issued",
            actor={"role": "registrar", "id": payload.issued_by},
        )
    except WorkflowError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    certificate = {
        "certificate_id": next_certificate_id(),
        "application_id": str(application["_id"]),
        "application_number": application["application_id"],
        "parcel_id": application["parcel_ref"]["parcel_id"],
        "certificate_type": application.get("type", "land_registration"),
        "status": "issued",
        "issued_to": application["applicant_ref"],
        "issued_by": payload.issued_by,
        "issued_at": now(),
        "verification": {
            "qr_code_url": f"/certificates/{application_id}/verify",
            "digital_signature_stub": f"signed-{uuid4()}",
        },
        "qr_code_url": f"/certificates/{application_id}/verify",
        "digital_signature_stub": f"signed-{uuid4()}",
    }
    result = db.certificates.insert_one(certificate)
    certificate["_id"] = result.inserted_id
    db.land_applications.update_one(
        {"_id": application["_id"]},
        {"$set": {"certificate_ref": str(result.inserted_id), "updated_at": now()}},
    )
    log_action(application, "certificate_issued", actor={"role": "registrar", "id": payload.issued_by})
    return serialize_object_id({"certificate": certificate, "application": updated_application})


@router.patch("/{application_id}/registrar-review")
def registrar_review(application_id: str, payload: RegistrarReviewInput, user: dict = Depends(require_roles("staff"))):
    try:
        application = get_application(application_id)
    except WorkflowError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    note = {
        "decision": payload.decision,
        "notes": payload.notes,
        "reviewed_by": user["linked_id"],
        "reviewed_at": now(),
        "visible_to_applicant": payload.visible_to_applicant,
    }
    update = {
        "legal_review_done": True,
        "registrar_decision": payload.decision,
        "updated_at": now(),
    }
    push = {"internal.notes": note}
    if payload.visible_to_applicant:
        push["internal.visible_registrar_notes"] = note
    db.land_applications.update_one({"_id": application["_id"]}, {"$set": update, "$push": push})
    updated = get_application(application_id)
    log_action(updated, "registrar_review", actor=payload.actor or {"role": "staff", "id": user["linked_id"]}, metadata=note)
    return serialize_object_id(updated)


@router.post("/{application_id}/documents")
def upload_document(application_id: str, payload: DocumentUploadInput, user: dict = Depends(get_current_user)):
    try:
        application = get_application(application_id)
    except WorkflowError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    ensure_application_access(application, user)

    document = payload.model_dump()
    document["application_id"] = str(application["_id"])
    document["uploaded_at"] = now()
    document["reviewed_by"] = None
    document["reviewed_at"] = None
    document["rejection_reason"] = None
    document["created_at"] = now()
    result = db.application_documents.insert_one(document)
    document["_id"] = result.inserted_id

    db.land_applications.update_one(
        {"_id": application["_id"]},
        {
            "$push": {"documents": payload.model_dump()},
            "$set": {"updated_at": now()},
        },
    )
    db.land_applications.update_one(
        {"_id": application["_id"], "required_documents.document_type": payload.document_type},
        {
            "$set": {
                "required_documents.$.status": payload.status,
                "required_documents.$.file_name": payload.file_name,
                "required_documents.$.file_url": payload.file_url,
                "required_documents.$.uploaded_at": now(),
            }
        },
    )
    log_action(application, "document_uploaded", actor=payload.uploaded_by, metadata={"document_type": payload.document_type})
    create_notification(application, f"Document uploaded: {payload.document_type}")
    return serialize_object_id(document)


@router.post("/{application_id}/objections")
def submit_objection(application_id: str, payload: ObjectionInput, user: dict = Depends(require_roles("applicant", "staff"))):
    try:
        application = get_application(application_id)
    except WorkflowError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    ensure_application_access(application, user)

    objection = payload.model_dump()
    objection["objection_id"] = f"OBJ-2026-{db.objections.count_documents({}) + 1:04d}"
    objection["application_id"] = str(application["_id"])
    objection["applicant_id"] = application["applicant_ref"]["applicant_id"]
    objection["objector_id"] = payload.submitted_by.get("id")
    objection["status"] = "submitted"
    objection["registrar_response"] = None
    objection["created_at"] = now()
    result = db.objections.insert_one(objection)
    objection["_id"] = result.inserted_id

    db.land_applications.update_one(
        {"_id": application["_id"]},
        {
            "$set": {
                "status": "under_objection",
                "workflow.current_state": "under_objection",
                "workflow.allowed_next": ALLOWED_TRANSITIONS["under_objection"],
                "objection.has_objection": True,
                "objection.objection_ids": [str(result.inserted_id)],
                "updated_at": now(),
            }
        },
    )
    log_action(application, "objection_submitted", actor=payload.submitted_by, metadata={"reason": payload.reason})
    create_notification(application, "Objection submitted and moved to under_objection")
    return serialize_object_id(objection)


@router.get("/{application_id}/timeline")
def application_timeline(application_id: str, user: dict = Depends(get_current_user)):
    try:
        application = get_application(application_id)
    except WorkflowError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    ensure_application_access(application, user)
    timeline = db.performance_logs.find_one({"application_id": str(application["_id"])}) or {
        "application_id": str(application["_id"]),
        "event_stream": [],
    }
    log_action(application, "timeline_viewed", actor={"role": user["role"], "id": user["linked_id"]})
    return serialize_object_id(timeline)


@router.post("/{application_id}/comments")
def add_comment(application_id: str, payload: CommentInput, user: dict = Depends(get_current_user)):
    try:
        application = get_application(application_id)
    except WorkflowError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    ensure_application_access(application, user)

    comment = {
        "comment": payload.comment,
        "actor": payload.actor or {"role": "applicant", "id": application["applicant_ref"]["applicant_id"]},
        "created_at": now(),
    }
    db.land_applications.update_one(
        {"_id": application["_id"]},
        {"$push": {"comments": comment}, "$set": {"updated_at": now()}},
    )
    db.notifications.insert_one(
        {
            "type": "email",
            "to": application["applicant_ref"]["applicant_id"],
            "message": f"A comment was added to application {application['application_id']}.",
            "sent": False,
            "stub": True,
            "recipient_type": "applicant",
            "recipient_id": application["applicant_ref"]["applicant_id"],
            "channel": "stub",
            "subject": "Comment added",
            "message": f"A comment was added to application {application['application_id']}.",
            "status": "created",
            "created_at": now(),
        }
    )
    log_action(application, "comment_added", actor=comment["actor"], metadata={"comment": payload.comment})
    return serialize_object_id(comment)


@router.post("/{application_id}/notes")
def add_application_note(application_id: str, payload: NoteInput, user: dict = Depends(get_current_user)):
    try:
        application = get_application(application_id)
    except WorkflowError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    ensure_application_access(application, user)

    note = {
        "application_id": str(application["_id"]),
        "note": payload.note,
        "visible_to_applicant": payload.visible_to_applicant,
        "staff_only": not payload.visible_to_applicant,
        "actor": payload.actor or {"role": user["role"], "id": user["linked_id"]},
        "created_at": now(),
    }
    result = db.application_notes.insert_one(note)
    note["_id"] = result.inserted_id
    push = {"internal.notes": note}
    if payload.visible_to_applicant:
        push["internal.visible_registrar_notes"] = note
    db.land_applications.update_one({"_id": application["_id"]}, {"$push": push, "$set": {"updated_at": now()}})
    log_action(application, "note_added", actor=note["actor"], metadata={"visible_to_applicant": payload.visible_to_applicant})
    return serialize_object_id(note)
