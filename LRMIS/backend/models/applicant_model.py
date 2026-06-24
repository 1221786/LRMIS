from pydantic import BaseModel, Field, field_validator

from models.common import ApplicantType


class ApplicantCreate(BaseModel):
    full_name: str = Field(..., min_length=2)
    applicant_type: ApplicantType = ApplicantType.citizen
    national_id: str | None = None
    registration_number: str | None = None
    phone: str
    email: str
    city: str = "Ramallah"
    neighborhood: str = "Al Tireh"
    zone_id: str = "ZONE-RM-01"
    language: str = "ar"
    preferred_contact: str = "email"

    @field_validator("email")
    @classmethod
    def valid_email(cls, value: str) -> str:
        if "@" not in value or "." not in value:
            raise ValueError("email must be valid")
        return value

    @field_validator("phone")
    @classmethod
    def valid_phone(cls, value: str) -> str:
        cleaned = value.replace("+", "").replace("-", "").replace(" ", "")
        if not cleaned.isdigit() or len(cleaned) < 8:
            raise ValueError("phone must be valid")
        return value

