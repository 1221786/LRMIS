from datetime import datetime, timezone
from typing import Any

from bson import ObjectId

from app.database import db, serialize_object_id

ALLOWED_TRANSITIONS = {
    "submitted": ["pre_checked", "missing_documents", "rejected", "on_hold"],
    "pre_checked": ["survey_required", "legal_review", "missing_documents", "rejected", "on_hold"],
    "survey_required": ["surveyed", "under_objection", "on_hold", "rejected"],
    "surveyed": ["legal_review", "under_objection", "missing_documents", "rejected"],
    "legal_review": ["approved", "rejected", "under_objection", "on_hold"],
    "approved": ["certificate_issued"],
    "certificate_issued": ["closed"],
    "missing_documents": ["submitted", "pre_checked"],
    "under_objection": ["legal_review", "rejected", "on_hold"],
    "on_hold": ["submitted", "pre_checked", "legal_review"],
    "rejected": [],
    "closed": [],
}


class WorkflowError(ValueError):
    pass


def now() -> datetime:
    return datetime.now(timezone.utc)


def object_id(value: Any) -> ObjectId | Any:
    try:
        return ObjectId(value)
    except Exception:
        return value


def get_application(application_id: str) -> dict:
    application = db.land_applications.find_one({"application_id": application_id})
    if not application:
        application = db.land_applications.find_one({"_id": object_id(application_id)})
    if not application:
        raise WorkflowError("Application not found")
    return application


def log_action(application: dict, action: str, actor: dict | None = None, metadata: dict | None = None) -> None:
    event = {
        "type": action,
        "at": now(),
        "by": actor or {"role": "system", "id": None},
        "metadata": metadata or {},
    }
    db.performance_logs.update_one(
        {"application_id": str(application["_id"])},
        {
            "$setOnInsert": {"application_id": str(application["_id"])},
            "$push": {"event_stream": event},
        },
        upsert=True,
    )


def validate_transition(application: dict, new_status: str) -> None:
    current_status = application.get("status")
    allowed_next = ALLOWED_TRANSITIONS.get(current_status, [])
    if new_status not in allowed_next:
        raise WorkflowError(f"Cannot move from {current_status} to {new_status}")

    if new_status == "pre_checked":
        applicant_ref = application.get("applicant_ref") or {}
        parcel_ref = application.get("parcel_ref") or {}
        required = [
            applicant_ref.get("applicant_id"),
            applicant_ref.get("full_name"),
            parcel_ref.get("parcel_number"),
            parcel_ref.get("block_number"),
            parcel_ref.get("basin_number"),
            parcel_ref.get("zone_id"),
            application.get("type") or application.get("application_type"),
        ]
        if not all(required):
            raise WorkflowError("Cannot pre_check unless applicant, application type, parcel number, block, basin, and zone are complete")

    if new_status == "survey_required":
        parcel_ref = application.get("parcel_ref") or {}
        parcel_id = parcel_ref.get("parcel_id")
        parcel = db.parcels.find_one({"_id": object_id(parcel_id)})
        geometry = parcel.get("geometry") if parcel else None
        if not is_valid_geojson_polygon(geometry):
            raise WorkflowError("Cannot require survey unless parcel geometry is valid GeoJSON Polygon")
        if not parcel_ref.get("zone_id"):
            raise WorkflowError("Cannot require survey unless zone_id is valid")
        if (application.get("type") or application.get("application_type")) == "certificate_request":
            raise WorkflowError("Certificate request does not require field survey")

    if new_status == "surveyed":
        report_exists = db.survey_reports.find_one(
            {
                "$or": [
                    {"application_id": str(application["_id"])},
                    {"application_number": application.get("application_id")},
                ],
                "status": {"$in": ["uploaded", "approved", None]},
            }
        )
        if not report_exists and not application.get("survey_report_exists"):
            raise WorkflowError("Cannot mark surveyed unless survey report exists")
        task = db.survey_tasks.find_one({"application_id": str(application["_id"])})
        if not task:
            task = db.survey_tasks.find_one({"application_number": application.get("application_id")})
        if not task or task.get("status") not in {"survey_completed", "report_uploaded", "registrar_reviewed"}:
            raise WorkflowError("Cannot mark surveyed unless survey task is completed or report uploaded")

    if new_status == "legal_review":
        documents = application.get("documents") or application.get("required_documents") or []
        has_ownership_doc = any(
            doc.get("document_type") == "ownership_deed"
            and doc.get("status") in {"uploaded", "pending_review", "verified"}
            for doc in documents
        )
        if not has_ownership_doc:
            db_doc = db.application_documents.find_one(
                {
                    "application_id": str(application["_id"]),
                    "document_type": "ownership_deed",
                    "review.status": {"$in": ["pending_review", "verified"]},
                }
            )
            if not db_doc:
                raise WorkflowError("Cannot enter legal_review unless ownership documents exist")
        missing_docs = [
            doc.get("document_type")
            for doc in (application.get("required_documents") or [])
            if doc.get("status") == "missing"
        ]
        if missing_docs:
            raise WorkflowError(f"Cannot enter legal_review while documents are missing: {', '.join(missing_docs)}")
        if not db.survey_reports.find_one({"application_id": str(application["_id"])}) and not application.get("survey_report_exists"):
            raise WorkflowError("Cannot enter legal_review unless survey report exists")

    if new_status == "approved":
        if not application.get("legal_review_done") and not application.get("legal_review_completed"):
            raise WorkflowError("Cannot approve unless legal review is done")
        if not application.get("registrar_decision"):
            raise WorkflowError("Cannot approve unless registrar decision exists")
        if application.get("objection", {}).get("has_objection"):
            raise WorkflowError("Cannot approve while open objections exist")
        missing_docs = [
            doc.get("document_type")
            for doc in (application.get("required_documents") or [])
            if doc.get("status") == "missing"
        ]
        if missing_docs:
            raise WorkflowError("Cannot approve while required documents are missing")

    if new_status == "certificate_issued":
        if current_status != "approved":
            raise WorkflowError("Cannot issue certificate unless application is approved")
        if not application.get("parcel_ref") or not application.get("applicant_ref"):
            raise WorkflowError("Cannot issue certificate unless parcel_ref and applicant_ref exist")


def is_valid_geojson_polygon(geometry: dict | None) -> bool:
    if not geometry or geometry.get("type") != "Polygon":
        return False
    coordinates = geometry.get("coordinates")
    if not isinstance(coordinates, list) or not coordinates:
        return False
    ring = coordinates[0]
    if not isinstance(ring, list) or len(ring) < 4:
        return False
    return ring[0] == ring[-1]


def transition_application(
    application_id: str,
    new_status: str,
    actor: dict | None = None,
    metadata: dict | None = None,
) -> dict:
    application = get_application(application_id)
    validate_transition(application, new_status)

    update = {
        "status": new_status,
        "workflow.current_state": new_status,
        "workflow.allowed_next": ALLOWED_TRANSITIONS.get(new_status, []),
        "updated_at": now(),
    }
    db.land_applications.update_one({"_id": application["_id"]}, {"$set": update})

    updated_application = get_application(application_id)
    log_action(
        updated_application,
        "status_transition",
        actor=actor,
        metadata={
            "from": application.get("status"),
            "to": new_status,
            **(metadata or {}),
        },
    )
    return serialize_object_id(updated_application)


def mark_legal_review_done(application_id: str, actor: dict | None = None) -> dict:
    application = get_application(application_id)
    db.land_applications.update_one(
        {"_id": application["_id"]},
        {"$set": {"legal_review_done": True, "updated_at": now()}},
    )
    updated_application = get_application(application_id)
    log_action(updated_application, "legal_review_done", actor=actor)
    return serialize_object_id(updated_application)
