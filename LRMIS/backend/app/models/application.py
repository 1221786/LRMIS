from enum import Enum

from pydantic import BaseModel, Field


class ApplicationType(str, Enum):
    first_registration = "first_registration"
    ownership_transfer = "ownership_transfer"
    parcel_subdivision = "parcel_subdivision"
    parcel_merge = "parcel_merge"
    boundary_correction = "boundary_correction"
    certificate_request = "certificate_request"


class ApplicationStatus(str, Enum):
    submitted = "submitted"
    pre_checked = "pre_checked"
    survey_required = "survey_required"
    surveyed = "surveyed"
    legal_review = "legal_review"
    approved = "approved"
    certificate_issued = "certificate_issued"
    closed = "closed"
    rejected = "rejected"
    on_hold = "on_hold"
    missing_documents = "missing_documents"
    under_objection = "under_objection"


class WorkflowState(BaseModel):
    current_state: ApplicationStatus = ApplicationStatus.submitted
    allowed_next: list[ApplicationStatus] = []


class ApplicantRef(BaseModel):
    applicant_id: str
    full_name: str


class ParcelRef(BaseModel):
    parcel_id: str
    parcel_number: str
    zone_id: str


class Application(BaseModel):
    application_id: str = Field(..., min_length=3)
    type: ApplicationType
    status: ApplicationStatus = ApplicationStatus.submitted
    workflow: WorkflowState
    parcel_ref: ParcelRef
    applicant_ref: ApplicantRef

