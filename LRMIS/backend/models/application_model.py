from pydantic import BaseModel, Field

from models.applicant_model import ApplicantCreate
from models.common import ApplicationStatus, ApplicationType
from models.parcel_model import ParcelCreate


class DocumentInput(BaseModel):
    document_type: str
    file_name: str | None = None
    file_url: str | None = None
    status: str = "pending_review"


class ApplicationCreate(BaseModel):
    application_type: ApplicationType
    applicant: ApplicantCreate
    parcel: ParcelCreate
    description: str = ""
    priority: str = "normal"
    documents: list[DocumentInput] = []


class TransitionRequest(BaseModel):
    new_status: ApplicationStatus
    note: str | None = None
    actor_type: str = "staff"
    actor_id: str | None = None


class ReasonRequest(BaseModel):
    reason: str = Field(..., min_length=3)


class DocumentUpload(BaseModel):
    document_type: str
    file_name: str
    file_url: str
    mime_type: str = "application/pdf"
    size: int = 0
    notes: str | None = None


class ObjectionCreate(BaseModel):
    applicant_id: str | None = None
    full_name: str
    reason: str = Field(..., min_length=5)
    supporting_documents: list[dict] = []

