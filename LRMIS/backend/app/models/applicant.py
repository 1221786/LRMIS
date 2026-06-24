from enum import Enum

from pydantic import BaseModel, Field


class ApplicantType(str, Enum):
    citizen = "citizen"
    lawyer = "lawyer"
    company = "company"


class ContactInfo(BaseModel):
    email: str
    phone: str


class Address(BaseModel):
    city: str
    area: str | None = None
    street: str | None = None


class Applicant(BaseModel):
    full_name: str = Field(..., min_length=2)
    national_id: str = Field(..., min_length=5)
    contacts: ContactInfo
    address: Address
    type: ApplicantType

