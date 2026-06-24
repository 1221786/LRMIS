from enum import Enum

from pydantic import BaseModel, Field


class CertificateStatus(str, Enum):
    issued = "issued"
    revoked = "revoked"
    draft = "draft"


class Certificate(BaseModel):
    certificate_id: str = Field(..., min_length=3)
    status: CertificateStatus = CertificateStatus.draft

