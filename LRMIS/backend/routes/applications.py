from bson import ObjectId
from fastapi import APIRouter, Header, HTTPException, Query
from pymongo.errors import DuplicateKeyError

from database import db, serialize_doc
from models.application_model import ApplicationCreate, DocumentUpload, ObjectionCreate, ReasonRequest, TransitionRequest
from models.certificate_model import RegistrarReviewRequest
from models.survey_model import SurveyMilestoneRequest, SurveyReportCreate
from routes.applicants import applicant_document
from services.assignment_service import auto_assign_surveyor
from services.certificate_service import issue_certificate
from services.log_service import add_log, add_notification
from services.workflow_service import allowed_next, now, required_documents, transition_update, validate_transition

router = APIRouter(prefix="/applications", tags=["Applications"])


def next_application_id():
    return f"LRMIS-2026-{db.land_applications.count_documents({}) + 1:04d}"


def get_application_or_404(application_id: str):
    app = db.land_applications.find_one({"application_id": application_id})
    if not app:
        try:
            app = db.land_applications.find_one({"_id": ObjectId(application_id)})
        except Exception:
            app = None
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app


def parcel_code(parcel):
    if parcel.parcel_code:
        return parcel.parcel_code
    return f"{parcel.zone_id}-B{parcel.block_number}-P{parcel.parcel_number}"


def upsert_applicant(payload):
    if payload.national_id:
        existing = db.applicants.find_one({"identity.national_id": payload.national_id})
        if existing:
            return existing
    doc = applicant_document(payload)
    try:
        result = db.applicants.insert_one(doc)
        doc["_id"] = result.inserted_id
    except DuplicateKeyError:
        doc = db.applicants.find_one({"identity.national_id": payload.national_id})
    return doc


def upsert_parcel(payload, applicant_id):
    code = parcel_code(payload)
    existing = db.parcels.find_one({"parcel_code": code})
    if existing:
        return existing
    doc = payload.model_dump()
    doc["parcel_code"] = code
    doc["geometry"] = payload.geometry.model_dump()
    doc["current_owner_refs"] = [{"applicant_id": applicant_id, "share": "1/1"}]
    doc["created_at"] = now()
    doc["updated_at"] = now()
    result = db.parcels.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


@router.post("/")
def create_application(payload: ApplicationCreate, idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
    if idempotency_key:
        existing = db.land_applications.find_one({"idempotency_key": idempotency_key})
        if existing:
            return serialize_doc(existing)

    applicant = upsert_applicant(payload.applicant)
    parcel = upsert_parcel(payload.parcel, applicant["_id"])
    application_id = next_application_id()
    docs = required_documents(payload.application_type.value, [item.model_dump() for item in payload.documents])
    doc = {
        "application_id": application_id,
        "application_type": payload.application_type.value,
        "status": "submitted",
        "priority": payload.priority,
        "applicant_ref": {
            "applicant_id": applicant["_id"],
            "full_name": applicant["full_name"],
            "applicant_type": applicant["applicant_type"],
            "email": applicant["contacts"]["email"],
            "submitted_by_representative": False,
        },
        "parcel_ref": {
            "parcel_id": parcel["_id"],
            "parcel_number": parcel["parcel_number"],
            "block_number": parcel["block_number"],
            "basin_number": parcel["basin_number"],
            "zone_id": parcel["zone_id"],
        },
        "description": payload.description or f"{payload.application_type.value} application for parcel {parcel['parcel_number']}.",
        "tags": [payload.application_type.value],
        "workflow": {"current_state": "submitted", "allowed_next": allowed_next("submitted"), "transition_rules_version": "v1.0"},
        "required_documents": docs,
        "timestamps": {
            "submitted_at": now(),
            "pre_checked_at": None,
            "survey_required_at": None,
            "surveyed_at": None,
            "legal_review_at": None,
            "approved_at": None,
            "certificate_issued_at": None,
            "closed_at": None,
            "updated_at": now(),
        },
        "assignment": {"assigned_surveyor_id": None, "assigned_registrar_id": None, "assignment_policy": "zone+workload+availability"},
        "objection": {"has_objection": False, "objection_ids": []},
        "certificate": {"certificate_id": None, "status": "not_issued"},
        "internal": {"notes": [], "registrar_remarks": [], "visibility": "staff_only"},
        "survey_report_exists": False,
        "legal_review_completed": False,
        "idempotency_key": idempotency_key,
    }
    result = db.land_applications.insert_one(doc)
    doc["_id"] = result.inserted_id
    db.applicants.update_one(
        {"_id": applicant["_id"]},
        {"$push": {"linked_applications": result.inserted_id}, "$inc": {"stats.total_applications": 1, "stats.pending_applications": 1}},
    )
    add_log(db, result.inserted_id, "submitted", actor_type="applicant", actor_id=str(applicant["_id"]), meta={"channel": "web"})
    return serialize_doc(doc)


@router.get("/")
def list_applications(
    status: str | None = None,
    type: str | None = Query(default=None),
    zone: str | None = None,
    priority: str | None = None,
    page: int = 1,
    limit: int = 20,
):
    query = {}
    if status:
        query["status"] = status
    if type:
        query["application_type"] = type
    if zone:
        query["parcel_ref.zone_id"] = zone
    if priority:
        query["priority"] = priority
    skip = max(page - 1, 0) * limit
    apps = list(db.land_applications.find(query).sort("timestamps.submitted_at", -1).skip(skip).limit(limit))
    return serialize_doc({"items": apps, "total": db.land_applications.count_documents(query), "page": page, "limit": limit})


@router.get("/{application_id}")
def get_application(application_id: str):
    app = get_application_or_404(application_id)
    app["applicant"] = db.applicants.find_one({"_id": app["applicant_ref"]["applicant_id"]})
    app["parcel"] = db.parcels.find_one({"_id": app["parcel_ref"]["parcel_id"]})
    app["survey_task"] = db.survey_tasks.find_one({"application_id": app["_id"]})
    app["objections"] = list(db.objections.find({"application_id": app["_id"]}))
    app["certificate_doc"] = db.certificates.find_one({"application_id": app["_id"]})
    return serialize_doc(app)


@router.patch("/{application_id}/transition")
def transition_application(application_id: str, payload: TransitionRequest):
    app = get_application_or_404(application_id)
    try:
        validate_transition(app, payload.new_status.value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    update = transition_update(payload.new_status.value)
    if payload.note:
        update["internal.notes"] = app.get("internal", {}).get("notes", []) + [{"note": payload.note, "at": now(), "by": payload.actor_type}]
    db.land_applications.update_one({"_id": app["_id"]}, {"$set": update})
    updated = get_application_or_404(application_id)
    add_log(db, app["_id"], payload.new_status.value, actor_type=payload.actor_type, actor_id=payload.actor_id, meta={"note": payload.note})
    add_notification(db, updated, f"Your application moved to {payload.new_status.value}")
    return serialize_doc(updated)


@router.post("/{application_id}/hold")
def hold_application(application_id: str, payload: ReasonRequest):
    return transition_application(application_id, TransitionRequest(new_status="on_hold", note=payload.reason))


@router.post("/{application_id}/reject")
def reject_application(application_id: str, payload: ReasonRequest):
    return transition_application(application_id, TransitionRequest(new_status="rejected", note=payload.reason))


@router.post("/{application_id}/documents")
def upload_document(application_id: str, payload: DocumentUpload):
    app = get_application_or_404(application_id)
    doc = {
        "application_id": app["_id"],
        "document_type": payload.document_type,
        "file_name": payload.file_name,
        "file_url": payload.file_url,
        "mime_type": payload.mime_type,
        "size": payload.size,
        "uploaded_by": {"actor_type": "applicant", "actor_id": app["applicant_ref"]["applicant_id"]},
        "review": {"status": "pending_review", "reviewed_by": None, "reviewed_at": None, "notes": payload.notes},
        "created_at": now(),
    }
    result = db.application_documents.insert_one(doc)
    doc["_id"] = result.inserted_id
    db.land_applications.update_one(
        {"_id": app["_id"], "required_documents.document_type": payload.document_type},
        {"$set": {"required_documents.$.status": "pending_review", "required_documents.$.file_name": payload.file_name, "required_documents.$.file_url": payload.file_url}},
    )
    add_log(db, app["_id"], "document_uploaded", actor_type="applicant", meta={"document_type": payload.document_type})
    return serialize_doc(doc)


@router.post("/{application_id}/comments")
def add_comment(application_id: str, payload: ReasonRequest):
    app = get_application_or_404(application_id)
    comment = {"note": payload.reason, "at": now(), "by": "applicant"}
    db.land_applications.update_one({"_id": app["_id"]}, {"$push": {"internal.registrar_remarks": comment}})
    add_log(db, app["_id"], "comment_added", actor_type="applicant")
    return serialize_doc(comment)


@router.post("/{application_id}/objections")
def submit_objection(application_id: str, payload: ObjectionCreate):
    app = get_application_or_404(application_id)
    objection = {
        "application_id": app["_id"],
        "submitted_by": {"applicant_id": payload.applicant_id or str(app["applicant_ref"]["applicant_id"]), "full_name": payload.full_name},
        "reason": payload.reason,
        "supporting_documents": payload.supporting_documents,
        "status": "submitted",
        "registrar_decision": None,
        "created_at": now(),
        "updated_at": now(),
    }
    result = db.objections.insert_one(objection)
    db.land_applications.update_one(
        {"_id": app["_id"]},
        {
            "$set": {"status": "under_objection", "workflow.current_state": "under_objection", "workflow.allowed_next": allowed_next("under_objection"), "objection.has_objection": True},
            "$push": {"objection.objection_ids": result.inserted_id},
        },
    )
    add_log(db, app["_id"], "objection_submitted", actor_type="applicant")
    objection["_id"] = result.inserted_id
    return serialize_doc(objection)


@router.get("/{application_id}/timeline")
def timeline(application_id: str):
    app = get_application_or_404(application_id)
    log = db.performance_logs.find_one({"application_id": app["_id"]}) or {"event_stream": []}
    return serialize_doc(log)


@router.post("/{application_id}/auto-assign-surveyor")
def assign_surveyor(application_id: str):
    app = get_application_or_404(application_id)
    try:
        result = auto_assign_surveyor(db, app)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return serialize_doc(result)


@router.patch("/{application_id}/survey-milestone")
def survey_milestone(application_id: str, payload: SurveyMilestoneRequest):
    app = get_application_or_404(application_id)
    task = db.survey_tasks.find_one({"application_id": app["_id"]})
    if not task:
        raise HTTPException(status_code=404, detail="Survey task not found")
    milestone = {"type": payload.milestone, "at": now(), "by": "surveyor", "meta": {"note": payload.note}}
    update = {"status": payload.milestone, "updated_at": now()}
    if payload.scheduled_date:
        update["scheduled_visit_date"] = payload.scheduled_date
    db.survey_tasks.update_one({"_id": task["_id"]}, {"$set": update, "$push": {"milestones": milestone}})
    add_log(db, app["_id"], f"survey_{payload.milestone}", actor_type="surveyor")
    return serialize_doc(db.survey_tasks.find_one({"_id": task["_id"]}))


@router.post("/{application_id}/survey-report")
def survey_report(application_id: str, payload: SurveyReportCreate):
    app = get_application_or_404(application_id)
    task = db.survey_tasks.find_one({"application_id": app["_id"]})
    if not task:
        raise HTTPException(status_code=404, detail="Survey task not found")
    report = {
        "application_id": app["_id"],
        "task_id": task["_id"],
        "parcel_id": app["parcel_ref"]["parcel_id"],
        "surveyor_id": task["assigned_surveyor_id"],
        "report_number": payload.report_number or f"REP-2026-{db.survey_reports.count_documents({}) + 1:04d}",
        "summary": payload.summary,
        "findings": {"boundary_matches": payload.boundary_matches, "area_sqm_measured": payload.area_sqm_measured, "has_dispute": payload.has_dispute},
        "attachments": payload.attachments,
        "status": "uploaded",
        "created_at": now(),
    }
    result = db.survey_reports.insert_one(report)
    db.survey_tasks.update_one({"_id": task["_id"]}, {"$set": {"report_uploaded": True, "status": "report_uploaded", "updated_at": now()}})
    db.land_applications.update_one({"_id": app["_id"]}, {"$set": {"survey_report_exists": True, "timestamps.updated_at": now()}})
    add_log(db, app["_id"], "survey_report_uploaded", actor_type="surveyor")
    report["_id"] = result.inserted_id
    return serialize_doc(report)


@router.patch("/{application_id}/registrar-review")
def registrar_review(application_id: str, payload: RegistrarReviewRequest):
    app = get_application_or_404(application_id)
    if payload.decision == "approved":
        db.land_applications.update_one({"_id": app["_id"]}, {"$set": {"legal_review_completed": True}})
        app["legal_review_completed"] = True
        try:
            validate_transition(app, "approved")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        db.land_applications.update_one({"_id": app["_id"]}, {"$set": transition_update("approved"), "$push": {"internal.registrar_remarks": {"note": payload.note, "by": payload.registrar_id, "at": now()}}})
        add_log(db, app["_id"], "registrar_approved", actor_type="registrar", actor_id=payload.registrar_id)
    elif payload.decision == "rejected":
        db.land_applications.update_one({"_id": app["_id"]}, {"$set": transition_update("rejected")})
        add_log(db, app["_id"], "registrar_rejected", actor_type="registrar", actor_id=payload.registrar_id)
    else:
        db.land_applications.update_one({"_id": app["_id"]}, {"$push": {"internal.registrar_remarks": {"note": payload.note, "decision": payload.decision, "at": now()}}})
    return serialize_doc(get_application_or_404(application_id))


@router.post("/{application_id}/certificate")
def create_certificate(application_id: str):
    app = get_application_or_404(application_id)
    try:
        certificate = issue_certificate(db, app)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return serialize_doc(certificate)

