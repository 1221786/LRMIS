from datetime import datetime, timezone

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

REQUIRED_DOCUMENTS_BY_TYPE = {
    "ownership_transfer": ["ownership_deed", "id_copy", "sale_contract", "parcel_map"],
    "first_registration": ["id_copy", "proof_of_possession", "parcel_map", "witness_statement"],
    "parcel_subdivision": ["ownership_deed", "survey_plan", "municipality_approval", "id_copy"],
    "parcel_merge": ["ownership_deed", "survey_plan", "municipality_approval", "id_copy"],
    "boundary_correction": ["ownership_deed", "survey_plan", "id_copy"],
    "certificate_request": ["id_copy", "previous_registration_number"],
}


def now():
    return datetime.now(timezone.utc)


def required_documents(application_type: str, supplied: list[dict] | None = None) -> list[dict]:
    supplied_by_type = {item["document_type"]: item for item in supplied or []}
    docs = []
    for document_type in REQUIRED_DOCUMENTS_BY_TYPE.get(application_type, []):
        incoming = supplied_by_type.get(document_type, {})
        docs.append(
            {
                "document_type": document_type,
                "required": True,
                "status": incoming.get("status", "missing"),
                "file_name": incoming.get("file_name"),
                "file_url": incoming.get("file_url"),
            }
        )
    return docs


def allowed_next(status: str) -> list[str]:
    return ALLOWED_TRANSITIONS.get(status, [])


def validate_transition(application: dict, new_status: str):
    current = application["status"]
    if new_status not in ALLOWED_TRANSITIONS.get(current, []):
        raise ValueError(f"Cannot move from {current} to {new_status}")

    if new_status == "pre_checked":
        if not application.get("applicant_ref") or not application.get("parcel_ref"):
            raise ValueError("Applicant and parcel information must be complete")

    if new_status == "survey_required":
        parcel = application.get("parcel_ref") or {}
        if not parcel.get("zone_id"):
            raise ValueError("Parcel location must be valid")

    if new_status == "surveyed" and not application.get("survey_report_exists", False):
        raise ValueError("Survey report is required")

    if new_status == "legal_review":
        docs = application.get("required_documents", [])
        ownership_uploaded = any(
            doc["document_type"] == "ownership_deed"
            and doc["status"] in ["uploaded", "verified", "pending_review"]
            for doc in docs
        )
        if not ownership_uploaded:
            raise ValueError("Ownership documents must be uploaded")

    if new_status == "approved" and not application.get("legal_review_completed", False):
        raise ValueError("Legal review must be completed")

    if new_status == "certificate_issued" and current != "approved":
        raise ValueError("Application must be approved first")


def transition_update(new_status: str) -> dict:
    timestamp_key = f"timestamps.{new_status}_at"
    update = {
        "status": new_status,
        "workflow.current_state": new_status,
        "workflow.allowed_next": allowed_next(new_status),
        "timestamps.updated_at": now(),
    }
    if new_status in {"pre_checked", "survey_required", "surveyed", "legal_review", "approved", "certificate_issued", "closed"}:
        update[timestamp_key] = now()
    return update

