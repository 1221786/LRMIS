from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, field_validator


class ApplicantType(str, Enum):
    citizen = "citizen"
    lawyer = "lawyer"
    company = "company"
    surveyor = "surveyor"
    authorized_representative = "authorized_representative"


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


class GeoJSONPolygon(BaseModel):
    type: str = "Polygon"
    coordinates: list[list[list[float]]]

    @field_validator("type")
    @classmethod
    def validate_type(cls, value: str) -> str:
        if value != "Polygon":
            raise ValueError("geometry type must be Polygon")
        return value

    @field_validator("coordinates")
    @classmethod
    def validate_coordinates(cls, value: Any) -> Any:
        if not value or not value[0] or len(value[0]) < 4:
            raise ValueError("Polygon must contain at least four coordinate pairs")
        return value


class Message(BaseModel):
    message: str

